const express = require("express")
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log("from verify jwt", authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" })
    }
    // bearer token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "unauthorized access" })
        }
        req.decoded = decoded;
        next()
    })
}





const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.h8hwzy8.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const sportsCollection = client.db("sportsDB").collection("sports");
        const usersCollection = client.db("sportsDB").collection("users");



        // jwt token

        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' })
            }
            next()
        }

        // sports related api
        app.get("/sports", async (req, res) => {
            const result = await sportsCollection.find().toArray();
            res.send(result)
        })

        app.get("/myClasses/:email", async (req, res) => {
            const email = req.params?.email;
            const result = await sportsCollection.find({ email }).toArray()
            res.send(result)
        })

        app.post("/sports", async (req, res) => {
            const sport = req.body;
            console.log("sport", sport);
            const result = await sportsCollection.insertOne(sport);
            res.send(result)
        })

        app.patch("/sports/approved/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateStatus = {
                $set: {
                    status: "approved"
                }
            }
            const result = await sportsCollection.updateOne(filter, updateStatus)
            res.send(result)
        })

        app.patch("/sports/denied/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateStatus = {
                $set: {
                    status: "deny"
                }
            }
            const result = await sportsCollection.updateOne(filter, updateStatus)
            res.send(result)
        })

        // user related apis
        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.post("/users", async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "User already exist" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        app.get("/users/admin/:email", async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            res.send(result)
        })

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: "admin"
                }
            }

            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.patch("/user/instructor/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    role: "instructor"
                }
            }
            const result = await usersCollection.updateOne(filter, update)
            res.send(result)
        })

        app.delete("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(filter);
            res.send(result)
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("park sports running")
})
app.listen(port, () => {
    console.log(`park sports running on port: ${port}`);
})