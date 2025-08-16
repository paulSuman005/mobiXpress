const errorMeddleware = (err, req, res) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "something went to wrong";

    res.status(err.statusCode).json({
        success: false,
        message: err.message,
        stack: err.stack
    })
}

export default errorMeddleware;