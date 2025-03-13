import express from "express";
import axios from "axios";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import cors from "cors";
// import SSLCommerzPayment from "sslcommerz-lts";

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

import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5q2fm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const store_id = process.env.STORE_ID;

// const store_passwd = process.env.STORE_PASSWD;
// const is_live = false; //true for live, false for sandbox

async function run() {
  try {
    const usersCollection = client.db("FORUM_X_DB").collection("users");
    const postsCollection = client.db("FORUM_X_DB").collection("posts");
    const commentsCollection = client.db("FORUM_X_DB").collection("comments");
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

    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        if (!user) {
          res.status(404).json({ message: "User not found!" });
        }

        res.status(200).json(user);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch user data" });
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

        // Insert new user with badge

        const newUser = {
          name,
          email,
          password,
          photoURL,
          badge: "Bronze", // Default bronze
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
        console.log("Post Data:", postData);
        const result = await postsCollection.insertOne(postData);
        res.status(201).send(result);
      } catch (error) {
        console.error(error);
      }
    });

    // Get all posts

    app.get("/posts", async (req, res) => {
      try {
        const { sort = "newest", page = 1 } = req.query;
        const limit = 5;
        const skip = (page - 1) * limit;
        let pipeline = [];

        // Add vote difference calculation

        pipeline.push({
          $addFields: {
            voteDifference: { $subtract: ["$upVote", "$downVote"] },
          },
        });

        // Sorting logic

        if (sort === "popular") {
          pipeline.push({ $sort: { voteDifference: -1 } }); // BIG to small
        } else {
          pipeline.push({ $sort: { createdAt: -1 } });
        }

        // Pagination

        pipeline.push({ $skip: skip }, { $limit: limit });

        // Get total count for pagination

        const totalPosts = await postsCollection.countDocuments();

        const posts = await postsCollection.aggregate(pipeline).toArray();

        res.status(200).send({
          posts,
          totalPosts,
          totalPages: Math.ceil(totalPosts / limit),
          currentPage: parseInt(page),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load posts" });
      }
    });

    // GET /posts/:id- Get single post

    app.get("/posts/:id", async (req, res) => {
      try {
        const id = req.params;
        const query = { _id: new ObjectId(id) };
        const post = await postsCollection.findOne(query);
        res.status(200).send(post);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch post" });
      }
    });

    // Users email wise data fetching (sort and limit = 3)

    app.get("/posts/user/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { limit = 3 } = req.query;
        const pipeline = [
          {
            $match: {
              authorEmail: email,
            },
          },
          {
            $sort: {
              createdAt: -1, // Oldest to newest
            },
          },
          {
            $limit: parseInt(limit),
          },
        ];

        const posts = await postsCollection.aggregate(pipeline).toArray();
        res.status(200).send(posts);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch user posts" });
      }
    });

    // ইউজারের সমস্ত পোস্ট ফেচ করার API

    app.get("/posts/user/:email/all", async (req, res) => {
      try {
        const { email } = req.params;
        // const { sort = "newest" } = req.query;

        const pipeline = [
          {
            $match: {
              authorEmail: email,
            },
          },

          {
            $sort: {
              createdAt: -1, // new to old posts
            },
          },
        ];

        const posts = await postsCollection.aggregate(pipeline).toArray();
        res.status(200).send(posts);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch user posts" });
      }
    });

    // Post tags

    app.post("/tags", async (req, res) => {
      try {
        const { tags } = req.body;
        const createdAt = new Date();

        // Insert tags into the database

        const tagDocuments = tags.map((tag) => ({
          name: tag,
          createdAt,
        }));

        console.log(tagDocuments, tags);

        const result = await tagsCollection.insertMany(tagDocuments);
        res.status(201).json({ message: "Tags added successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add tags" });
      }
    });

    // PUT /posts/:id/upvote-Increment upvote

    app.put("/posts/:id/upvote", async (req, res) => {
      try {
        const id = req.params;
        const filter = { _id: new ObjectId(id) };

        const result = await postsCollection.updateOne(filter, {
          $inc: { upVote: 1 },
        });
        res.status(200).send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to upvote" });
      }
    });

    // PUT /posts/:id/downvote- Increment

    app.put("/posts/:id/downvote", async (req, res) => {
      try {
        const id = req.params;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = { $inc: { downVote: 1 } };

        const result = await postsCollection.updateOne(filter, updatedDoc);

        res.status(200).send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to downvote" });
      }
    });

    // POST /comments- Add new comment

    app.post("/comments", async (req, res) => {
      try {
        const newComment = {
          ...req.body,
          createdAt: new Date(),
        };
        const result = await commentsCollection.insertOne(newComment);

        res.status(201).send(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add comment" });
      }
    });

    // Get all comments

    app.get("/comments", async (req, res) => {
      try {
        const { postId } = req.query; // Get postId from query parameters
        const query = postId ? { postId } : {};
        const result = await commentsCollection.find(query).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load comments" });
      }
    });

    // Get /api/tags

    app.get("/tags", async (req, res) => {
      try {
        const tags = await tagsCollection.find().toArray();
        res.status(200).send(tags);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load tags" });
      }
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
