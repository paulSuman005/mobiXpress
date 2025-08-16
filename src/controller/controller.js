import mongoose from "mongoose";
import AppError from "../utils/error.js";


const getHome = async (req, res, next) => {
    try {
        const homeCollection = mongoose.connection.collection("home");
        const homeData = await homeCollection.find({}).toArray();

        res.status(201).json({
            success: true,
            data: homeData
        })
    } catch (err) {
        next(new AppError(err.message, 400));
    }
}



const getAllOffers = async (req, res, next) => {

    try {
        const offerCollection = mongoose.connection.collection("offers");
        const offerData = await offerCollection.find().toArray();
        console.log("offerData : ", offerData);

        res.status(201).json({
            success: true,
            data: offerData
        })
    } catch (err) {
        next(new AppError(err.message, 400));
    }
}

const searchProducts = async (req, res) => {
  const { branchId, brandId, modelId, searchValue } = req.body;

  try {
    const productListCollection = mongoose.connection.collection("productList");

    const matchObj = {};

    // If branchId exists (not empty), match exactly
    if (branchId) {
      matchObj.branch_id = branchId;
    }

    // If brandId is array and has values -> match any brand in array
    if (Array.isArray(brandId) && brandId.length > 0) {
      matchObj.brand_id = { $in: brandId };
    }

    // If modelId is array and has values -> match any model in array
    if (Array.isArray(modelId) && modelId.length > 0) {
      matchObj.model_id = { $in: modelId };
    }

    // If searchValue exists → filter on item_name
    if (searchValue) {
      matchObj.item_name = { $regex: searchValue, $options: "i" };
    }

    const productList = await productListCollection
      .aggregate([{ $match: matchObj }])
      .toArray();

    res.status(200).json({ message: "success", data: productList });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "error" });
  }
};


const getProductById = async (req, res, next) => {
    const { itemId } = req.body;

    if(!itemId){
        return next(new AppError('itemId is required!', 400));
    }

    try {
        const productListCollection = mongoose.connection.collection("productList");
        const productData = await productListCollection.findOne({item_id: itemId});

        res.status(201).json({
            success: true,
            data: productData
        })
    } catch (err) {
        return next(new AppError(err.message, 400));
    }
}

const productByBranchId = async (req, res, next) => {
    const { branchId } = req.body;

    try {
        const productListCollection = mongoose.connection.collection("productList");
        const productDetails = await productListCollection.find({branch_id: branchId}).toArray();
        const branchCollection = mongoose.connection.collection('branchList');
        const branchDetails = await branchCollection.findOne({branch_id: branchId});

        res.status(201).json({
            success: true,
            data: {productDetails, branchDetails}
        })
    } catch (err) {
        return next(new AppError(err.message, 400));
    }
}

const allBranch = async (req, res, next) => {
    try {
        const branchCollection = mongoose.connection.collection('branchList');
        const branchList = await branchCollection.find({}).toArray();

        res.status(201).json({
            success: true,
            data: branchList
        })
    } catch (err) {
        return next(new AppError(err.message, 400));
    }
}








export { getHome, searchProducts, getProductById, productByBranchId, allBranch, getAllOffers }