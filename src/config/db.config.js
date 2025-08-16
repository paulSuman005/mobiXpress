import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

const connectionToDB = async () => {
    try {
        const conn = await mongoose.connect(MONGODB_URI);
        console.log(`Database connected to ${conn.connection.host}`);
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
}

export default connectionToDB;