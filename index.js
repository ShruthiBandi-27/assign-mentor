import express from 'express';
import {MongoClient} from "mongodb";
import * as dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 5000;
const MONGO_URL = process.env.MONGO_URL;

//create connection to db
async function createConnection() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log("Connected to mongodb");
    return client;
}

export const client = await createConnection();

app.use(express.json());
app.use(cors());

app.get("/", (req, res)=> {
    res.send("<h1>Hello, Welcome to Student Mentor App!!!</h1>");
})

//creating mentor
app.post("/mentor", async (req, res) => {
    const mentor = req.body;
    mentor.id = uuidv4();
    console.log(`mentor: ${mentor}`);
    const result = await client.db("studentMentor").collection("mentors").insertOne(mentor);
    res.status(200).send({
        message: "Mentor created successfully"
    });
})

//creating student
app.post("/student", async (req, res) => {
    const mentor = req.body;
    mentor.id = uuidv4();
    console.log(`mentor: ${mentor}`);
    const result = await client.db("studentMentor").collection("students").insertOne(mentor);
    res.status(200).send({
        message: "Student created successfully"
    });
});

//assign student to mentor
app.post("/assignstudent", async (req, res) => {
    const assign = req.body;
    const {student_names, mentor_name} = req.body;
    console.log(`student_name: ${student_names}, mentor_name: ${mentor_name}, assign: ${JSON.stringify(assign)}`)
    console.log(`assign: ${assign}`);

    //fetching the students and mentors from mentors and students table
    const mentorPresentInMentorsTable = await client.db("studentMentor").collection("mentors").findOne({mentor_name: mentor_name});
    const students = await client.db("studentMentor").collection("students").find({ student_name: { $in: student_names } }).toArray();

    //Checking if any new student who is not present in students table is included in list
    const foundStudentNames = students.map((student) => student.student_name);
    const notFoundStudents = student_names.filter(
      (student) => !foundStudentNames.includes(student)
    );

    console.log(`mentorPresent: ${JSON.stringify(mentorPresentInMentorsTable)}, studentPresent: ${JSON.stringify(foundStudentNames)}`);
    if(notFoundStudents.length > 0 ||  !mentorPresentInMentorsTable) {
        res.status(404).send({
            message: "Student or mentor not found"
        });
        return;
    }

    //Checking if Mentor is already assigned to a Student
    const assignStudentRes =  await client.db("studentMentor").collection("assignStudent").find().toArray();
    const MentorsAssignedStudents = assignStudentRes.map((doc) => doc.student_names);
    const finalStudents  = MentorsAssignedStudents.flat();

    console.log(`assignStudentRes = ${JSON.stringify(MentorsAssignedStudents)}\n finalStudents: ${finalStudents}`);
    const MentorsAlreadyAssignedStudents = student_names.filter((student) => finalStudents.includes(student));
    
    console.log(`MentorsAlreadyAssignedStudents: ${MentorsAlreadyAssignedStudents}`);
    if(MentorsAlreadyAssignedStudents.length > 0){
        res.status(400).send({
            message: `Mentors already assigned to Students ${MentorsAlreadyAssignedStudents}`
        });
        return;
    }
    
    //Checking mentor in assignStudent table
    const mentorPresent = await client.db("studentMentor").collection("assignStudent").findOne({mentor_name: mentor_name});
    if(!mentorPresent){
        const newMentorStundents = await client.db("studentMentor").collection("assignStudent").insertOne(assign)
    }
    else {
    const updateStudentList = await client.db("studentMentor").collection("assignStudent").updateOne(
        {mentor_name},
        { $push: { student_names: { $each: student_names } } }
       // {$push: {student_names: student_names}} 
        )
    }
    res.status(200).send({
        message: "Students assignment successful"
    });
});

//fetching students of particular mentor
app.get("/fetchStudents/:mentor", async (req, res) => {
    const {mentor} = req.params;
    //const {mentor} = req.query;
    console.log(`mentor: ${mentor}`);
    const students = await client.db("studentMentor").collection("assignStudent").aggregate([
        {
            $match: {
                mentor_name: mentor
            }
        },
        {
            $project: {
                student_names : 1,
                _id: 0
            }
        }
    ]).toArray();
    //const students = await client.db("studentMentor").collection("assignStudent").find({mentor_name: mentor},{student_names:1, mentor_name:0}).toArray();
    res.status(200).send(students[0]);

});

app.listen(PORT, ()=> {
    console.log(`The server is listening on port ${PORT}`);
});

console.log("End of index.js");