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

  if(!branchId && !brandId && !modelId && !searchValue){
    return next(new AppError('no product found!', 400));
  }

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



const getProductByIdtestCodeflow = async (req, res, next) => {
  const { modelId } = req.body;

  if (!modelId) {
    return next(new AppError("model id is required!", 400));
  }

  try {
    const productListCollection = mongoose.connection.collection("productList");

    const numericModelId = Number(modelId);
    if (isNaN(numericModelId)) {
      return next(new AppError("model id must be a valid number!", 400));
    }

    const items = await productListCollection
      .find({ model_id: numericModelId })
      .toArray();

    console.log('items : ', items);

    if (!items.length) {
      return res.status(404).json({ message: "No items found for this model_id" });
    }

    const conditionSet = new Set();
    items.forEach(item => {
      if (item.item_condition) {
        conditionSet.add(item.item_condition.trim().toLowerCase());
      }
    });

    const uniqueConditions = Array.from(conditionSet);

    const uniqueBranchIds = new Set();
    items.forEach(item => {
      if (item.branch_id) {
        uniqueBranchIds.add(item.branch_id);
      }
    });

    const uniqueBranchIdsArray = Array.from(uniqueBranchIds)
    console.log('uniqueBranch: ', uniqueBranchIdsArray);

    const allBranchCollection = mongoose.connection.collection('branchList');
    const allBranchList = await allBranchCollection.aggregate([
      {$match: {'branch_id': {$in: uniqueBranchIdsArray}}}
    ]).toArray();

    console.log('all branches : ', allBranchList);
      // const branches = allBranchList.map(b=>b.branch_id)
    
    items.forEach(item => {
      allBranchList.forEach(ele => {
        if(item.branch_id == ele.branch_id){
          item.branch_details = ele;
        }
      })
    });

    const lowestItem = items.reduce((minItem, currentItem) => {
      if (
        typeof currentItem.sale_price_with_tax === "number" &&
        (minItem === null || currentItem.sale_price_with_tax < minItem.sale_price_with_tax)
      ) {
        return currentItem;
      }
      return minItem;
    }, null);
    const updatedItems = items.filter(item => item !== lowestItem);

    const firstInvDate = new Date(lowestItem.first_inv_date); // "2023-10-09"
    const today = new Date();
    const diffMs = today.getTime() - firstInvDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";

    const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");
//    const colors = await modelImageColorListCollection.aggregate([
//   {
//     $match: { model_id: modelId }
//   },
//   {
//     $group: {
//       _id: "$color_code",
//       color_name: { $first: "$color_name" },

//     }
//   },
//   {
//     $project: {
//       _id: 0,
//       color_code: "$_id",
//       color_name: 1,
//     }
//   }
// ]).toArray();

  const colors = await modelImageColorListCollection.find( { model_id: modelId }, { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 } ).toArray();

  const storageMasterCollection = mongoose.connection.collection("storageMaster");
  const storage = await storageMasterCollection.aggregate([
    {$match: {model_id: modelId}},
    {
      $group: {
        _id: "$storage_name",
        storage_id: { $first: "$storage_id" },
      }
    },
    {
      $project: {
        _id: 0,
        storage_name: "$_id",
        storage_id: 1
      }
    }
  ]).toArray();

  const allModelCollection = mongoose.connection.collection("allModel");
  // const allModels = await allModelCollection.find({'model_id': modelId},{'model_image': 1, 'model_description': 1, _id: 0}).toArray();
  const allModels = await allModelCollection.aggregate([
      {$match: {'model_id': modelId}},
      {
        $project: {'model_image': 1, 'model_description': 1, _id: 0}
      }
  ]).toArray();


    // Step 4: Return both
    res.status(200).json({
      message: "success",
      lowestItem,
      conditions: uniqueConditions,
      item_age:diffDays,
      modelDetails: allModels,
      colors: colors,
      storage: storage,
      relatedItems: updatedItems,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "error" });
  }
};


const getRelatedProducts = async (req, res, next) => {
  const {modelId} = req.body;

  if(!modelId){
    return next(new AppError('model id is required!', 400));
  }

  try {
    const productListCollection = mongoose.connection.collection("productList");

    const numericModelId = Number(modelId);
    if (isNaN(numericModelId)) {
      return next(new AppError("model id must be a valid number!", 400));
    }

    const items = await productListCollection
      .find({ model_id: numericModelId })
      .toArray();

    const uniqueBranchIds = new Set();
    const allUniqueColorIds = new Set();

    items.forEach(item => {
      if (item.branch_id) {
        uniqueBranchIds.add(item.branch_id);
      }
      if(item.item_colour){
        const col = Number(item.item_colour);
        allUniqueColorIds.add(col);
      }
    });

    const uniqueBranchIdsArray = Array.from(uniqueBranchIds);
    const uniqueColorIdsArray = Array.from(allUniqueColorIds);
    console.log('uniqueBranch: ', uniqueBranchIdsArray);
    console.log('uniqueBranch: ', uniqueColorIdsArray);

    const allBranchCollection = mongoose.connection.collection('branchList');
    const allBranchList = await allBranchCollection.aggregate([
      {$match: {'branch_id': {$in: uniqueBranchIdsArray}}}
    ]).toArray();

    // console.log('all branches : ', allBranchList);

    const colorMasterListCollection = mongoose.connection.collection('colorMasterList');
    const allColorList = await colorMasterListCollection
      .aggregate([
        { $match: { color_id: { $in: uniqueColorIdsArray } } }
      ])
      .toArray();
    
      console.log("allColor : ", allColorList);
    
    items.forEach(item => {
      allBranchList.forEach(ele => {
        if(item.branch_id === ele.branch_id){
          item.branch_details = ele;
        }
      })

      allColorList.forEach(ele => {
        if(Number(item.item_colour) === ele.color_id){
          item.colorDetails = ele;
        }
      })
    });

    const uniqueColors = new Set();
    items.forEach(item => {
      if(item.colorDetails.color_code){
        uniqueColors.add(item.colorDetails.color_code);
      }
    })
    const colorArray = Array.from(uniqueColors);

    const modelImageColorListCollection = mongoose.connection.collection('modelImageColorList');
    const imageList = await modelImageColorListCollection.find({model_id: modelId, color_code: {$in: colorArray}}).toArray();


    console.log('image list : ', imageList);
  
    items.forEach(item => {
      const matchedImage = imageList.find(ele => ele.color_code === item.colorDetails.color_code);
      if (matchedImage) {
        item.imageDetails = matchedImage;
      }
    });

    console.log(items);

    res.status(201).json({
      success: true,
      relatedItems: items
    });


  } catch (err) {
    return next(new AppError(err.message, 400));
  }
}



const getProductById = async (req, res, next) => {
  const { modelId } = req.body;

  if (!modelId) {
    return next(new AppError("model id is required!", 400));
  }

  try {
    const productListCollection = mongoose.connection.collection("productList");

    const numericModelId = Number(modelId);
    if (isNaN(numericModelId)) {
      return next(new AppError("model id must be a valid number!", 400));
    }

    const items = await productListCollection
      .find({ model_id: numericModelId })
      .toArray();

    console.log('items : ', items);

    if (!items.length) {
      return res.status(404).json({ message: "No items found for this model_id" });
    }

    const conditionSet = new Set();
    items.forEach(item => {
      if (item.item_condition) {
        conditionSet.add(item.item_condition.trim().toLowerCase());
      }
    });

    const uniqueConditions = Array.from(conditionSet);

    const lowestItem = items.reduce((minItem, currentItem) => {
      if (
        typeof currentItem.sale_price_with_tax === "number" &&
        (minItem === null || currentItem.sale_price_with_tax < minItem.sale_price_with_tax)
      ) {
        return currentItem;
      }
      return minItem;
    }, null);

    const allBranchCollection = mongoose.connection.collection('branchList');
    const branch_details = await allBranchCollection.findOne({'branch_id': lowestItem.branch_id});


    const firstInvDate = new Date(lowestItem.first_inv_date); // "2023-10-09"
    const today = new Date();
    const diffMs = today.getTime() - firstInvDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";

    

  const storageMasterCollection = mongoose.connection.collection("storageMaster");
  const storage = await storageMasterCollection.aggregate([
    {$match: {model_id: modelId}},
    {
      $group: {
        _id: "$storage_name",
        storage_id: { $first: "$storage_id" },
      }
    },
    {
      $project: {
        _id: 0,
        storage_name: "$_id",
        storage_id: 1
      }
    }
  ]).toArray();

  storage.forEach(ele => {
    if(ele.storage_id === lowestItem.item_colour){
      lowestItem.storage = ele
    }
  })

  const allModelCollection = mongoose.connection.collection("allModel");
  const allModels = await allModelCollection.aggregate([
      {$match: {'model_id': modelId}},
      {
        $project: {'model_image': 1, 'model_description': 1, _id: 0}
      }
  ]).toArray();

  const colorMasterListCollection = mongoose.connection.collection("colorMasterList");
  const itemColorId = Number(lowestItem.item_colour);
  const lowestItemColor = await colorMasterListCollection.findOne({'color_id': itemColorId});

  lowestItem.color = lowestItemColor;

  const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");

  const imageDetails = await modelImageColorListCollection.findOne( { 'model_id': modelId, 'color_code': lowestItemColor.color_code }, { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 } );
  lowestItem.image = imageDetails;

  const uniqueColorIds = new Set();
  items.forEach(item => {
    if(item.item_colour){
      const itemColId = Number(item.item_colour);
      uniqueColorIds.add(itemColId);
    }
  })

  const allColorsArray = Array.from(uniqueColorIds);
  console.log('allcolorArray : ', allColorsArray);

  const colors = await colorMasterListCollection.find({
    color_id: { $in: allColorsArray }
  }).toArray();


    // Step 4: Return both
    res.status(200).json({
      message: "success",
      lowestItem,
      conditions: uniqueConditions,
      item_age:diffDays,
      modelDetails: allModels,
      branchDetails: branch_details,
      colors: colors,
      storage: storage,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: "error" });
  }
};





const productByBranchId = async (req, res, next) => {
    const { branchId } = req.body;

    try {
        const productListCollection = mongoose.connection.collection("productList");

        const productDetails = await productListCollection.find({'branch_id': branchId, 'item_status': "Active", 'online_available': "yes"}).toArray();

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


const productDetails = async (req, res, next) => {
  const {modelId, storageName, colorCode} = req.body;

  if(!modelId && !storageName && !colorCode){
    return next('product not found!', 404);
  }

  try {
    const matchObj = {};
    if(storageName){
      const storageMasterCollection = mongoose.connection.collection("storageMaster");
      const storageDetails = await storageMasterCollection.findOne({'storage_name': storageName, 'model_id': modelId});
      matchObj.storage_id = storageDetails.storage_id;
    }

    if(colorCode){
      console.log(`${modelId} and ${colorCode}`);
      const colorMasterListCollection = mongoose.connection.collection('colorMasterList');
      const colorDetails = await colorMasterListCollection.findOne({'model_id': modelId, 'color_code': colorCode});
      console.log('colordetails : ', colorDetails);
      if(colorDetails.color_id){
        matchObj.item_colour = String(colorDetails.color_id);
      }
    }

    const productListCollection = mongoose.connection.collection('productList');
    const productDetails = await productListCollection.findOne(matchObj);

    const branchListCollection = mongoose.connection.collection('branchList');
    const branchDetails = await branchListCollection.findOne({branch_id: productDetails.branch_id});

    const numericModelId = Number(modelId);
    if (isNaN(numericModelId)) {
      return next(new AppError("model id must be a valid number!", 400));
    }

    const items = await productListCollection
      .find({ model_id: numericModelId })
      .toArray();

    console.log('items : ', items);

    if (!items.length) {
      return res.status(404).json({ message: "No items found for this model_id" });
    }

    const conditionSet = new Set();
    items.forEach(item => {
      if (item.item_condition) {
        conditionSet.add(item.item_condition.trim().toLowerCase());
      }
    });

    const uniqueConditions = Array.from(conditionSet);

    const firstInvDate = new Date(productDetails.first_inv_date); // "2023-10-09"
    const today = new Date();
    const diffMs = today.getTime() - firstInvDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";



  const storageMasterCollection = mongoose.connection.collection("storageMaster");
  const storage = await storageMasterCollection.aggregate([
    {$match: {model_id: modelId}},
    {
      $group: {
        _id: "$storage_name",
        storage_id: { $first: "$storage_id" },
      }
    },
    {
      $project: {
        _id: 0,
        storage_name: "$_id",
        storage_id: 1
      }
    }
  ]).toArray();

  storage.forEach(ele => {
    if(ele.storage_id === productDetails.item_colour){
      productDetails.storage = ele
    }
  })

  const allModelCollection = mongoose.connection.collection("allModel");
  const allModels = await allModelCollection.aggregate([
      {$match: {'model_id': modelId}},
      {
        $project: {'model_image': 1, 'model_description': 1, _id: 0}
      }
  ]).toArray();

  const colorMasterListCollection = mongoose.connection.collection("colorMasterList");
  const itemColorId = Number(productDetails.item_colour);
  const lowestItemColor = await colorMasterListCollection.findOne({'color_id': itemColorId});

  productDetails.color = lowestItemColor;

  const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");

  const imageDetails = await modelImageColorListCollection.findOne( { 'model_id': modelId, 'color_code': lowestItemColor.color_code }, { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 } );
  productDetails.image = imageDetails;

  const uniqueColorIds = new Set();
  items.forEach(item => {
    if(item.item_colour){
      const itemColId = Number(item.item_colour);
      uniqueColorIds.add(itemColId);
    }
  })

  const allColorsArray = Array.from(uniqueColorIds);
  console.log('allcolorArray : ', allColorsArray);

  const colors = await colorMasterListCollection.find({
    color_id: { $in: allColorsArray }
  }).toArray();


    // Step 4: Return both
    res.status(200).json({
      message: "success",
      lowestItem: productDetails,
      conditions: uniqueConditions,
      item_age:diffDays,
      modelDetails: allModels,
      branchDetails: branchDetails,
      colors: colors,
      storage: storage,
    });


  } catch (err) {
    return next(new AppError(err.message, 400));
  }

}

const getAllModel = async (req, res, next) => {
  const allModelCollection = mongoose.connection.collection('allModel');

  try {
    const ModelList = await allModelCollection.find({}).toArray();

    res.status(201).json({
      success: true,
      ModelList: ModelList
    })
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
}


const getAllBrand = async (req, res, next) => {
  const allBrandCollection = mongoose.connection.collection('brandList');

  try {
    const brandList = await allBrandCollection.find({}).toArray();

    res.status(201).json({
      success: true,
      brandList: brandList
    })
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
}



export { getHome, searchProducts, productByBranchId, allBranch, getAllOffers, getProductById , productDetails, getRelatedProducts, getAllModel, getAllBrand}