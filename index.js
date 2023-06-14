require('dotenv').config()
const express = require("express")
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;

// middleware
// app.use(cors())
app.use(
    cors({
        origin: "*",
        methods: "GET,POST,PATCH,PUT,DELETE",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
    })
);
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log("from verify jwt", authorization);
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" })
    }
    // bearer token
    const token = authorization.split(' ')[1];
    // console.log(token);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        console.log(err);
        if (err) {
            return res.status(403).send({ error: true, message: "forbidden access" })
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
        // await client.connect();

        const sportsCollection = client.db("sportsDB").collection("sports");
        const usersCollection = client.db("sportsDB").collection("users");
        const selectClassCollection = client.db("sportsDB").collection("select")
        const paymentCollection = client.db("sportsDB").collection("payments")



        // jwt token

        app.post("/jwt", (req, res) => {
            const user = req.body;
            // console.log("user", user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' })
            console.log(token);
            res.send({ token })
        })

        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            console.log("user", user);
            if (user?.role !== 'admin') {
                return res.status(200).send({ error: true, message: 'forbidden message' })
            }
            next()
        }
        // Warning: use verifyJWT before using verifyAdmin
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            console.log("instructor", user);
            if (user?.role !== 'instructor') {
                return res.status(200).send({ error: true, message: 'forbidden message' })
            }
            next()
        }

        // sports related api
        app.get("/sports", async (req, res) => {
            const result = await sportsCollection.find().toArray();
            res.send(result)
        })

        app.get("/popularClass", async (req, res) => {
            const filter = { status: "approved" }
            const result = await sportsCollection.find(filter).sort({ total_enroll: -1 }).limit(6).toArray()
            res.send(result)
        })

        app.get("/myClasses/:email", verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params?.email;
            const result = await sportsCollection.find({ email }).toArray()
            res.send(result)
        })

        app.get("/allClasses", async (req, res) => {
            const filter = { status: "approved" }
            const result = await sportsCollection.find(filter).toArray()
            // console.log(result);
            res.send(result)
        })

        app.post("/sports", async (req, res) => {
            const sport = req.body;
            const result = await sportsCollection.insertOne(sport);
            res.send(result)
        })

        app.patch("/sports/approved/:id", verifyJWT, verifyAdmin, async (req, res) => {
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

        app.patch("/sports/denied/:id", verifyJWT, verifyAdmin, async (req, res) => {
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

        app.patch("/sports/feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const body = req.body
            // console.log("body", body);
            const filter = { _id: new ObjectId(id) }
            const updateFeedback = {
                $set: {
                    feedback: body.message
                }
            }
            const result = await sportsCollection.updateOne(filter, updateFeedback)
            res.send(result)
        })

        // user related apis
        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.post("/users", verifyJWT, async (req, res) => {
            const user = req.body;
            // console.log("user", user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: "User already exist" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })

        // check admin
        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const result = { admin: user?.role === 'admin' }
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

        app.delete("/users/admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await usersCollection.deleteOne(filter);
            res.send(result)
        })

        // check instructor
        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            // console.log('user-email', email);

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query)
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })

        app.get("/popularInstructor", async (req, res) => {
            const filter = { role: "instructor" }
            const result = await usersCollection.find(filter).limit(6).toArray()
            // console.log(result);
            res.send(result)
        })
        app.get("/allInstructor", async (req, res) => {
            const filter = { role: "instructor" }
            const result = await usersCollection.find(filter).toArray()
            // console.log(result);
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



        // selected class related apis
        app.get("/select", verifyJWT, async (req, res) => {
            const email = req.query?.email;
            console.log(email);
            if (!email) {
                return res.send([])
            }
            const decodedEmail = req?.decoded?.email;
            if (email !== decodedEmail) {
                return res.status(401).send({ error: true, message: "forbidden access" })
            }
            console.log(decodedEmail);
            const query = { email: email }
            const result = await selectClassCollection.find(query).toArray();
            res.send(result)
        })

        app.post("/select", async (req, res) => {
            const body = req.body;
            const result = await selectClassCollection.insertOne(body)
            // console.log(result);
            res.send(result)
        })

        app.delete("/select/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await selectClassCollection.deleteOne(filter)
            res.send(result)
        })


        // create payment intent
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseFloat(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        // payment related apis

        app.get("/myEnrollClass", verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(401).send({ error: true, message: "forbidden access" })
            }
            const filter = { email: email }
            const result = await paymentCollection.find(filter).sort({ date: -1 }).toArray()
            res.send(result)
        })

        app.delete("/myEnrollClass/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await paymentCollection.deleteOne(filter)
            res.send(result)
        })

        app.post("/payments", verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log("payment", payment);
            const id = payment.selectId
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: new ObjectId(id) }
            const deleteResult = await selectClassCollection.deleteMany(query)
            const updateSeat = await sportsCollection.updateOne(
                { _id: new ObjectId(payment.classId) },
                { $inc: { "available_seat": -1, "total_enroll": 1 } }
            )

            res.send({ insertResult, deleteResult, updateSeat })
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