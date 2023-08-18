// Importing Express & Puppet
const { puppet } = require("./puppet");
const express = require("express");
const {NodeCluster} = require("./cluster");

// Initializing Express
const app = express();
const port = process.env.PORT || 4993;
let cluster;

// Middleware
// - Body Parser
app.use(express.json());

// Routes
app.post("/fetchHistory", async (req, res) => {

    const payload = {
        cookies: req.body.cookies,
        user_uuid: req.body.user_uuid
    }

    let result = cluster.getCluster().execute(payload);

    res.status(200).json({
        code: 200,
        message: "Task started."
    });
});

// Listening to Requests
app.listen(port, async () => {
    console.log(`Server is listening on port ${port}`);
    cluster = new NodeCluster();
    await cluster.start();
});