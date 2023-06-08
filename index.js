const express = require("express")
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json());





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

        // sports related api
        app.get("/sports", async (req, res) => {
            const result = await sportsCollection.find().toArray();
            // console.log("sports", result);
            res.send(result)
        })

        app.post("/sports", async (req, res) => {
            const sport = req.body;
            console.log("sport", sport);
            const result = await sportsCollection.insertOne(sport);
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