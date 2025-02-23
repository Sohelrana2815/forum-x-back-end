import express, { json } from "express";
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
    const usersCollection = client.db("FORUM_X_DB").collection("users");
    const postsCollection = client.db("FORUM_X_DB").collection("posts");
    const tagsCollection = client.db("FORUM_X_DB").collection("tags");
    // Get all users data

    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load users" });
      }
    });

    // Post API For Upload images

    app.post("/upload-image", async (req, res) => {
      try {
        if (!req.files?.image) {
          return res.status(400).json({ error: "No image uploaded" });
        }

        const imageFile = req.files.image;
        console.log(imageFile);
        console.log("Received file details:", {
          name: imageFile.name,
          type: imageFile.mimetype,
          size: imageFile.size,
        });

        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ];
        if (!allowedTypes.includes(imageFile.mimetype)) {
          return res.status(415).json({ error: "Unsupported file type" });
        }

        // Validate file size
        const maxSize = 5 * 1024 * 1024;
        if (imageFile.size > maxSize) {
          return res.status(413).json({ error: "File exceeds 5MB limit" });
        }

        // Convert to base64
        // const base64Image = imageFile.data.toString("base64");
        const base64Image = imageFile.data.toString("base64");
        console.log("Base64 prefix:", base64Image.substring(0, 20)); // Verify encoding

        // Upload to ImgBB
        const params = new URLSearchParams();
        params.append("image", base64Image);

        const imgBBResponse = await axios.post(
          `https://api.imgbb.com/1/upload?key=${process.env.IMG_BB_API_KEY}`,
          params,
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        console.log("ImgBB response:", imgBBResponse.data);

        if (!imgBBResponse.data.success) {
          throw new Error(
            "ImgBB upload failed:" + imgBBResponse.data.error.message
          );
        }

        res.json({
          success: true,
          url: imgBBResponse.data.data.url,
        });
      } catch (error) {
        console.error("Full error:", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Post API For Storing users credentials

    app.post("/register-user", async (req, res) => {
      try {
        const { name, email, password, photoURL } = req.body;

        // Validate input
        if (!name || !email || !password || !photoURL) {
          return res.status(400).json({ error: "All fields are required" });
        }

        // Check email already exists in database

        const existingUser = await usersCollection.findOne({ email });

        if (existingUser) {
          return res.status(400).json({ error: "User already exist" });
        }

        // Insert new user

        const newUser = {
          name,
          email,
          password,
          photoURL,
        };

        const result = await usersCollection.insertOne(newUser);
        res.status(200).send(result);
      } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Add Post API

    app.post("/add-posts", async (req, res) => {
      try {
        const postData = req.body;

        if (!postData) {
          return res.status(400).json({ message: "Missing Post data." });
        }
        const result = await postsCollection.insertOne(postData);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
      }
    });

    // Get all posts

    app.get("/posts", async (req, res) => {
      try {
        const result = await postsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load posts" });
      }
    });

    // Post tags

    app.post("/tags", async (req, res) => {
      const tags = req.body;
      console.log("tags name", tags);
    });
  } finally {
    // bla bal
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Forum-X Server is Running...");
});

app.listen(PORT, () => {
  console.log(`Forum-X is running on port ${PORT}`);
});
