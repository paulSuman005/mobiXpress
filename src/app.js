import express, { Router } from 'express';
import errorMeddleware from './middleware/errorHandler.js';
import router from './router/router.js';
import morgan from 'morgan';
import cors from 'cors';

const app = express();

const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true
}

app.use(cors(corsOptions));

app.use(express.json());
app.use(morgan('dev'));


app.use("/test", (req, res) => {
    res.send("wellcome to MobiXpress");
})

app.use("/api", router);

app.use((req, res) => {                   // handling the invalid or unknown route
    console.log("invalid route");
    res.status(404).send("OOPS!! 404 page not found");
});


app.use(errorMeddleware); // general error handling middleware

export default app;