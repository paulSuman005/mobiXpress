import 'dotenv/config';
import app from "./app.js";
import connectionToDB from './config/db.config.js';

const PORT = process.env.PORT;

app.listen(PORT, async () => {
    await connectionToDB();
    console.log(`server is running at http://localhost:${PORT}`);
})