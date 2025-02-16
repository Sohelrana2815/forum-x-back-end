import express from "express";
import axios from "axios";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use(express.json());
app.use(fileUpload());
app.use(
  cors({
    origin: ["http://localhost:5173"],
  })
);

// Image Upload Endpoint

app.post("/upload-image", async (req, res) => {
  try {
    // Validate file existence

    if (!req.files?.image) {
      return res
        .status(400)
        .json({ success: false, error: "No image uploaded" });
    }

    const imageFile = req.files.image;
    console.log("Received image file:", imageFile.name); // log file received

    // Validate file type

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(imageFile.mimetype)) {
      return res.status(415).json({ error: "Unsupported file type" });
    }

    // Validate file size (5MB max)

    const maxSize = 5 * 1024 * 1024;

    if (imageFile.size > maxSize) {
      return res.status(413).json({ error: "File exceeds 5MB limit" });
    }

    // Convert to base64 for ImgBB

    const base64Image = imageFile.data.toString("base64");

    // Upload to ImgBB

    const imgBBResponse = await axios.post("https://api.imgbb.com/1/upload", {
      image: base64Image,
      key: process.env.IMG_BB_API_KEY,
    });

    if (!imgBBResponse.data.success) {
      throw new Error("Image upload failed");
    }

    console.log(
      "Image upload to ImgBB successfully! URL:",
      imgBBResponse.data.data.url
    ); // ImgBB upload success

    res.json({
      success: true,
      url: imgBBResponse.data.data.url,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

import { MongoClient, ServerApiVersion } from "mongodb";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5q2fm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Forum-X Server is Running...");
});

app.listen(PORT, () => {
  console.log(`Forum-X is running on port ${PORT}`);
});
