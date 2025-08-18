import mongoose from "mongoose";
import AppError from "../utils/error.js";
import fs from 'fs/promises';
import path from "path";

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
  console.log(brandId);

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
      console.log("brandId : ",brandId);
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

    console.log(productList);

    const uniqueBranchIds = new Set();
    const uniqueStorageIds = new Set();
    const uniqueModelIds = new Set();
    const uniqueColorIds = new Set();

    productList.forEach(item => {
      if(item.branch_id){
        uniqueBranchIds.add(item.branch_id);
      }
      if(item.storage_id){
        uniqueStorageIds.add(item.storage_id);
      }
      if(item.model_id){
        uniqueModelIds.add(item.model_id);
      }
      if(item.item_colour){
        const colorId = Number(item.item_colour);
        if(!isNaN(colorId)){
          uniqueColorIds.add(colorId)
        }
      }
    })

    const branchIdsArray = Array.from(uniqueBranchIds);
    if(branchIdsArray && branchIdsArray.length > 0){
      const branchListCollection = mongoose.connection.collection('branchList');
      const branchList = await branchListCollection.find({branch_id: {$in: branchIdsArray}}).toArray();
      productList.forEach(item => {
        branchList.forEach(ele => {
          if(item.branch_id === ele.branch_id){
            item.branch_name = ele.branch_name;
          }
        })
      })
    }

    const storageIdsArray = Array.from(uniqueStorageIds);
    if(storageIdsArray && storageIdsArray.length > 0){
      const storageMasterCollection = mongoose.connection.collection('storageMaster');
      const storageList = await storageMasterCollection.find({storage_id: {$in: storageIdsArray}}).toArray();
      productList.forEach(item => {
        storageList.forEach(ele => {
          if(item.storage_id === ele.storage_id){
            item.storage_name = ele.storage_name;
          }
        })
      })
    }

    const colorIdsArray = Array.from(uniqueColorIds);
    if(colorIdsArray && colorIdsArray.length > 0){
      const colorMasterListCollection = mongoose.connection.collection('colorMasterList');
      const colorList = await colorMasterListCollection.find({color_id: {$in: colorIdsArray}}).toArray();
      productList.forEach(item => {
        colorList.forEach(ele => {
          if(Number(item.item_colour) === ele.color_id){
            item.colorDetails = ele;
          }
        })
      })
    }

    productList.forEach(item => {
      uniqueModelIds.add(item.model_id);
    })

    const uniqueModelIdsArray = Array.from(uniqueModelIds);
    if(uniqueModelIdsArray && uniqueModelIdsArray.length > 0){
      const modelImageColorListCollection = mongoose.connection.collection('modelImageColorList');
      const modelImageList = await modelImageColorListCollection.aggregate([
        {
          $match: {
            model_id: { $in: uniqueModelIdsArray }
          }
        },
        {
          $group: {
            _id: "$model_id",
            images: { $push: "$image" }
          }
        },
        {
          $project: {
            _id: 0,
            model_id: "$_id",
            images: 1
          }
        }
      ]).toArray();
      productList.forEach(item => {
        const found = modelImageList.find(ele => Number(item.model_id) === ele.model_id);
        if (found) {
          item.images = found.images;
        } else {
          item.images = [];
        }
      });
    }

    productList.forEach(item => {
      if(item.first_inv_date){
        const firstInvDate = new Date(item.first_inv_date); // "2023-10-09"
        const today = new Date();
        const diffMs = today.getTime() - firstInvDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";
        item.item_age = diffDays
      }
    })


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

    items.forEach(item => {
      if(item.first_inv_date){
        const firstInvDate = new Date(item.first_inv_date); // "2023-10-09"
        const today = new Date();
        const diffMs = today.getTime() - firstInvDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";
        item.item_age = diffDays
      }
    })

    const uniqueStorageIds = new Set();
    items.forEach(item => {
      if(item.storage_id){
        uniqueStorageIds.add(item.storage_id);
      }
    })

    const uniqueStorageIdArray = Array.from(uniqueStorageIds);

    const storageMasterCollection = mongoose.connection.collection('storageMaster');
    const storageDetails = await storageMasterCollection
    .find({ storage_id: { $in: uniqueStorageIdArray } })
    .toArray();

    items.forEach(item => {
      storageDetails.forEach(ele => {
        if(item.storage_id === ele.storage_id){
          item.storage_name = ele.storage_name;
        }
      })
    })

    console.log(items);

    res.status(201).json({
      success: true,
      relatedItems: items
    });


  } catch (err) {
    return next(new AppError(err.message, 400));
  }
}



// const getProductById = async (req, res, next) => {
//   const { modelId, itemId } = req.body;

//   if (!modelId) {
//     return next(new AppError("model id is required!", 400));
//   }

//   try {
//     const productListCollection = mongoose.connection.collection("productList");

//     const numericModelId = Number(modelId);
//     if (isNaN(numericModelId)) {
//       return next(new AppError("model id must be a valid number!", 400));
//     }

//     const items = await productListCollection
//       .find({ model_id: numericModelId })
//       .toArray();

//     console.log('items : ', items);

//     if (!items.length) {
//       return res.status(404).json({ message: "No items found for this model_id" });
//     }

//     const conditionSet = new Set();
//     items.forEach(item => {
//       if (item.item_condition) {
//         conditionSet.add(item.item_condition.trim().toLowerCase());
//       }
//     });

//     const uniqueConditions = Array.from(conditionSet);

//     let lowestItem;
//     if(itemId){
//       const itemNumeric = Number(itemId);
//       console.log("item id : ",itemNumeric);
//       if(isNaN(itemNumeric)){
//         return next(new AppError("item id must be a valid number!", 400));
//       }
//       lowestItem = items.find(item => item.item_id === itemNumeric);
//       console.log("lowest item : ",lowestItem)
//     }else{
//       lowestItem = items.reduce((minItem, currentItem) => {
//       if (
//           typeof currentItem.sale_price_with_tax === "number" &&
//           (minItem === null || currentItem.sale_price_with_tax < minItem.sale_price_with_tax)
//         ) {
//           return currentItem;
//         }
//         return minItem;
//       }, null);
//     }
    

//     const allBranchCollection = mongoose.connection.collection('branchList');
//     const branch_details = await allBranchCollection.findOne({'branch_id': lowestItem.branch_id});


//     const firstInvDate = new Date(lowestItem.first_inv_date); // "2023-10-09"
//     const today = new Date();
//     const diffMs = today.getTime() - firstInvDate.getTime();
//     const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";

    

//   const storageMasterCollection = mongoose.connection.collection("storageMaster");
//   const storage = await storageMasterCollection.aggregate([
//     {$match: {model_id: modelId}},
//     {
//       $group: {
//         _id: "$storage_name",
//         storage_id: { $first: "$storage_id" },
//       }
//     },
//     {
//       $project: {
//         _id: 0,
//         storage_name: "$_id",
//         storage_id: 1
//       }
//     }
//   ]).toArray();

//   storage.forEach(ele => {
//     if(ele.storage_id === lowestItem.item_colour){
//       lowestItem.storage = ele
//     }
//   })

//   const allModelCollection = mongoose.connection.collection("allModel");
//   const allModels = await allModelCollection.aggregate([
//       {$match: {'model_id': modelId}},
//       {
//         $project: {'model_image': 1, 'model_description': 1, _id: 0}
//       }
//   ]).toArray();

//   const colorMasterListCollection = mongoose.connection.collection("colorMasterList");
//   const itemColorId = Number(lowestItem.item_colour);
//   const lowestItemColor = await colorMasterListCollection.findOne({'color_id': itemColorId});

//   lowestItem.color = lowestItemColor;

//   const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");

//   const imageDetails = await modelImageColorListCollection.find( { 'model_id': modelId, 'color_code': lowestItemColor.color_code }, { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 } ).toArray();
//   lowestItem.image = imageDetails;

//   const uniqueColorIds = new Set();
//   items.forEach(item => {
//     if(item.item_colour){
//       const itemColId = Number(item.item_colour);
//       uniqueColorIds.add(itemColId);
//     }
//   })

//   const allColorsArray = Array.from(uniqueColorIds);
//   console.log('allcolorArray : ', allColorsArray);

//   const colors = await colorMasterListCollection.find({
//     color_id: { $in: allColorsArray }
//   }).toArray();


//     // Step 4: Return both
//     res.status(200).json({
//       message: "success",
//       lowestItem,
//       conditions: uniqueConditions,
//       item_age:diffDays,
//       modelDetails: allModels,
//       branchDetails: branch_details,
//       colors: colors,
//       storage: storage,
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(400).json({ message: "error" });
//   }
// };
const getProductById = async (req, res, next) => {
  const { modelId, itemId } = req.body;

  if (!modelId) {
    return next(new AppError("model id is required!", 400));
  }

  try {
    const productListCollection = mongoose.connection.collection("productList");

    const numericModelId = Number(modelId);
    if (isNaN(numericModelId)) {
      return next(new AppError("model id must be a valid number!", 400));
    }

    // fetch all items by model_id
    const items = await productListCollection.find({ model_id: numericModelId }).toArray();
    console.log("items :", items);

    if (!items.length) {
      return res.status(404).json({ message: "No items found for this model_id" });
    }

    // get unique conditions
    const conditionSet = new Set();
    items.forEach((item) => {
      if (item.item_condition) {
        conditionSet.add(item.item_condition.trim().toLowerCase());
      }
    });
    const uniqueConditions = Array.from(conditionSet);

    // logic to decide lowestItem
    let lowestItem;

    // if itemId passed, return exact item
    if (itemId) {
      const itemNumeric = Number(itemId);
      console.log("item id :", itemNumeric);
      if (isNaN(itemNumeric)) {
        return next(new AppError("item id must be a valid number!", 400));
      }
      lowestItem = items.find((item) => item.item_id === itemNumeric);
      if (!lowestItem) {
        return res.status(404).json({ message: "Item not found for this item_id" });
      }
    }
    // else return lowest priced item
    else {
      lowestItem = items.reduce((minItem, currentItem) => {
        if (
          typeof currentItem.sale_price_with_tax === "number" &&
          (minItem === null || currentItem.sale_price_with_tax < minItem.sale_price_with_tax)
        ) {
          return currentItem;
        }
        return minItem;
      }, null);
    }

    // branch details
    const allBranchCollection = mongoose.connection.collection("branchList");
    const branch_details = await allBranchCollection.findOne({
      branch_id: lowestItem.branch_id,
    });

    // item age
    const firstInvDate = new Date(lowestItem.first_inv_date);
    const today = new Date();
    const diffMs = today.getTime() - firstInvDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + " days";

    // storage info
    const storageMasterCollection = mongoose.connection.collection("storageMaster");
    const storage = await storageMasterCollection
      .aggregate([
        { $match: { model_id: modelId } },
        {
          $group: {
            _id: "$storage_name",
            storage_id: { $first: "$storage_id" },
          },
        },
        {
          $project: {
            _id: 0,
            storage_name: "$_id",
            storage_id: 1,
          },
        },
      ])
      .toArray();

    storage.forEach((ele) => {
      if (ele.storage_id === lowestItem.item_colour) {
        lowestItem.storage = ele;
      }
    });

    // model details
    const allModelCollection = mongoose.connection.collection("allModel");
    const allModels = await allModelCollection
      .aggregate([
        { $match: { model_id: modelId } },
        { $project: { model_image: 1, model_description: 1, _id: 0 } },
      ])
      .toArray();

    // color details
    const colorMasterListCollection = mongoose.connection.collection("colorMasterList");
    const itemColorId = Number(lowestItem.item_colour);
    const lowestItemColor = await colorMasterListCollection.findOne({
      color_id: itemColorId,
    });
    lowestItem.color = lowestItemColor;

    // color-wise image
    const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");
    const imageDetails = await modelImageColorListCollection
      .find(
        {
          model_id: modelId,
          color_code: lowestItemColor.color_code,
        },
        { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 }
      )
      .toArray();
    lowestItem.image = imageDetails;

    // all available colors for this model
    const uniqueColorIds = new Set();
    items.forEach((item) => {
      if (item.item_colour) {
        const itemColId = Number(item.item_colour);
        uniqueColorIds.add(itemColId);
      }
    });
    const allColorsArray = Array.from(uniqueColorIds);
    console.log("allcolorArray :", allColorsArray);
    const colors = await colorMasterListCollection
      .find({ color_id: { $in: allColorsArray } })
      .toArray();

    // final response
    return res.status(200).json({
      message: "success",
      lowestItem,
      conditions: uniqueConditions,
      item_age: diffDays,
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
        if(!productDetails && productDetails.length){
          return next(new AppError('product not found!', 400));
        }
        console.log(productDetails);

        const uniqueColorIds = new Set();
        productDetails.forEach(item => {
          if(item.item_colour){
            const colId = Number(item.item_colour)
            uniqueColorIds.add(colId);
          }
        })
        const uniqueColorIdsArray = Array.from(uniqueColorIds);

        const colorMasterListCollection = mongoose.connection.collection('colorMasterList');
        const allColorList = await colorMasterListCollection
          .aggregate([
            { $match: { color_id: { $in: uniqueColorIdsArray } } },
            { $project: {color_id: 1, color_code: 1, _id: 0}}
          ])
          .toArray();
        
          console.log("allColor : ", allColorList);

          const uniqueColors = new Set();
          productDetails.forEach(item => {
            allColorList.forEach(ele => {
              if( Number(item.item_colour) === ele.color_id){
                item.colorDetails = ele;
              }
            })

            if (item.colorDetails && item.colorDetails.color_code) {
              uniqueColors.add(item.colorDetails.color_code);
            }
          })
        
          // const uniqueColors = new Set();
          // productDetails.forEach(item => {
          //   if(item.colorDetails.color_code){
          //     uniqueColors.add(item.colorDetails.color_code);
          //   }
          // })

          productDetails.forEach(item => {
            if (item.colorDetails && item.colorDetails.color_code) {
              uniqueColors.add(item.colorDetails.color_code);
            }
          });

          const colorArray = Array.from(uniqueColors);

          const modelImageColorListCollection = mongoose.connection.collection('modelImageColorList');
          // const imageList = await modelImageColorListCollection.find({model_id: modelId, color_code: {$in: colorArray}}).toArray();


          
          const imageList = await modelImageColorListCollection.find({ 
            model_id: { $in: productDetails.map(p => p.model_id) },
            color_code: { $in: colorArray }
          }).toArray();

          // const imageList = await modelImageColorListCollection.find({ // modified bt claude.ai 📌📌📌📌
          //   model_id: { $in: productDetails.map(p => p.model_id) },
          //   color_code: { $in: colorArray, $exists: true, $ne: null }
          // }).toArray();

          // console.log(imageList);

          // productDetails.forEach(item=>{
          //   imageList.forEach(img)
          // })
        
          // productDetails.forEach(item => {
          //   let matchedImage;
          //   if(item.colorDetails.color_code){
          //     matchedImage = imageList.find(ele => ele.color_code === item.colorDetails.color_code);
          //   }else{
          //     const allModelCollection = mongoose.connection.collection('allModel');
          //     matchedImage = allModelCollection.find({model_id: item.model_id}).toArray();
          //   }
          //   if(matchedImage){
          //     item.imageDetails = matchedImage;
          //   }else{
          //     item.imageDetails = undefined;
          //   }
          // });

          productDetails.forEach(async (item) => {
          let matchedImage;

          if (item.colorDetails && item.colorDetails.color_code) {
            matchedImage = imageList.find(ele => ele.color_code === item.colorDetails.color_code);
          } else {
            const allModelCollection = mongoose.connection.collection('allModel');
            matchedImage = await allModelCollection.findOne({ model_id: item.model_id });
          }

          if (matchedImage) {
            item.imageDetails = matchedImage;
          } else {
            item.imageDetails = undefined;
          }
        });


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


// const productDetails = async (req, res, next) => {
//   const {modelId, storageName, colorCode, itemCondition} = req.body;

//   if(!modelId && !storageName && !colorCode){
//     return next('product not found!', 404);
//   }

//   try {
//     const matchObj = {};
//     if(storageName){
//       const storageMasterCollection = mongoose.connection.collection("storageMaster");
//       const storageDetails = await storageMasterCollection.findOne({'storage_name': storageName, 'model_id': modelId});
//       console.log(storageDetails);
//       if(!storageDetails){
//         return next(new AppError('this storage is unavailable!', 404))
//       }
//       matchObj.storage_id = storageDetails.storage_id;
//     }

//     if(colorCode){
//       console.log(`${modelId} and ${colorCode}`);
//       const colorMasterListCollection = mongoose.connection.collection('colorMasterList');
//       const colorDetails = await colorMasterListCollection.findOne({'color_code': colorCode});
//       console.log('colordetails : ', colorDetails);
//       if(colorDetails && colorDetails.color_id){
//         matchObj.item_colour = String(colorDetails.color_id);
//       }else{
//         return next(new AppError('color is not found', 404));
//       }
//     }

//     if(itemCondition){
//       matchObj.item_condition = itemCondition;
//     }

//     const productListCollection = mongoose.connection.collection('productList');
//     const productDetails = await productListCollection.findOne(matchObj);
//     if(!productDetails){
//       return next(new AppError('product not found!', 400));
//     }

//     const branchListCollection = mongoose.connection.collection('branchList');
//     const branchDetails = await branchListCollection.findOne({branch_id: productDetails.branch_id});

//     const numericModelId = Number(modelId);
//     if (isNaN(numericModelId)) {
//       return next(new AppError("model id must be a valid number!", 400));
//     }

//     const items = await productListCollection
//       .find({ model_id: numericModelId })
//       .toArray();

//     console.log('items : ', items);

//     if (!items.length) {
//       return res.status(404).json({ message: "No items found for this model_id" });
//     }

//     const conditionSet = new Set();
//     items.forEach(item => {
//       if (item.item_condition) {
//         conditionSet.add(item.item_condition.trim().toLowerCase());
//       }
//     });

//     const uniqueConditions = Array.from(conditionSet);

//     const firstInvDate = new Date(productDetails.first_inv_date); // "2023-10-09"
//     const today = new Date();
//     const diffMs = today.getTime() - firstInvDate.getTime();
//     const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) +"days";



//   const storageMasterCollection = mongoose.connection.collection("storageMaster");
//   const storage = await storageMasterCollection.aggregate([
//     {$match: {model_id: modelId}},
//     {
//       $group: {
//         _id: "$storage_name",
//         storage_id: { $first: "$storage_id" },
//       }
//     },
//     {
//       $project: {
//         _id: 0,
//         storage_name: "$_id",
//         storage_id: 1
//       }
//     }
//   ]).toArray();

//   // if(!storage || !storage.length>0){
//   //   return next(new AppError('storage not found', 400))
//   // }

//   storage.forEach(ele => {
//     if(ele.storage_id === productDetails.item_colour){
//       productDetails.storage = ele
//     }
//   })

//   const allModelCollection = mongoose.connection.collection("allModel");
//   const allModels = await allModelCollection.aggregate([
//       {$match: {'model_id': modelId}},
//       {
//         $project: {'model_image': 1, 'model_description': 1, _id: 0}
//       }
//   ]).toArray();
//   // if(!allModels || !allModels.length>0){
//   //   return next(new AppError('model not found', 400))
//   // }

//   const colorMasterListCollection = mongoose.connection.collection("colorMasterList");
//   const itemColorId = Number(productDetails.item_colour);
//   const lowestItemColor = await colorMasterListCollection.findOne({'color_id': itemColorId});
//   // if(!lowestItemColor){
//   //   return next(new AppError('item color not found', 400))
//   // }

//   productDetails.color = lowestItemColor;

//   const modelImageColorListCollection = mongoose.connection.collection("modelImageColorList");

//   const imageDetails = await modelImageColorListCollection.findOne( { 'model_id': modelId, 'color_code': lowestItemColor.color_code }, { color_code: 1, image: 1, color_name: 1, _id: 0, id: 1 } );
//   // if(!imageDetails || !imageDetails.length > 0){
//   //   return next(new AppError('images not found', 400))
//   // }
//   productDetails.image = imageDetails;

//   const uniqueColorIds = new Set();
//   items.forEach(item => {
//     if(item.item_colour){
//       const itemColId = Number(item.item_colour);
//       uniqueColorIds.add(itemColId);
//     }
//   })

//   const allColorsArray = Array.from(uniqueColorIds);
//   console.log('allcolorArray : ', allColorsArray);

//   const colors = await colorMasterListCollection.find({
//     color_id: { $in: allColorsArray }
//   }).toArray();

//   // if(!colors || !colors.length > 0){
//   //   return next(new AppError('colors not found', 400))
//   // }

//     // Step 4: Return both
//     res.status(200).json({
//       message: "success",
//       lowestItem: productDetails,
//       conditions: uniqueConditions,
//       item_age:diffDays,
//       modelDetails: allModels,
//       branchDetails: branchDetails,
//       colors: colors,
//       storage: storage,
//     });


//   } catch (err) {
//     return next(new AppError(err.message, 400));
//   }

// }
const productDetails = async (req, res, next) => {
  const { modelId, storageName, colorCode, itemCondition } = req.body;

  if (!modelId) {
    return next(new AppError("model id is required!", 400));
  }

  try {
    const matchObj = { model_id: Number(modelId) };  // always match modelId

    // filter by storage
    if (storageName) {
      const storageMasterCollection = mongoose.connection.collection("storageMaster");
      const storageDetails = await storageMasterCollection.findOne({
        storage_name: storageName,
        model_id: Number(modelId),
      });
      if (!storageDetails) {
        return next(new AppError("this storage is unavailable!", 404));
      }
      matchObj.storage_id = storageDetails.storage_id;
    }

    // filter by color
    if (colorCode) {
      const colorMasterListCollection =
        mongoose.connection.collection("colorMasterList");
      const colorDetails = await colorMasterListCollection.findOne({
        color_code: colorCode,
      });
      if (!colorDetails) {
        return next(new AppError("color is not found", 404));
      }
      matchObj.item_colour = String(colorDetails.color_id);
    }

    // filter by condition
    if (itemCondition) {
      matchObj.item_condition = itemCondition;
    }

    // find the item
    const productListCollection = mongoose.connection.collection("productList");
    const productDetails = await productListCollection.findOne(matchObj);
    if (!productDetails) {
      return next(new AppError("product not found!", 404));
    }

    // branch
    const branchListCollection = mongoose.connection.collection("branchList");
    const branchDetails = await branchListCollection.findOne({
      branch_id: productDetails.branch_id,
    });

    // fetch all products of the same model to generate option sets
    const items = await productListCollection
      .find({ model_id: Number(modelId) })
      .toArray();

    const conditionSet = new Set();
    const colorIdSet = new Set();
    items.forEach((item) => {
      if (item.item_condition) {
        conditionSet.add(item.item_condition.trim().toLowerCase());
      }
      if (item.item_colour) {
        colorIdSet.add(Number(item.item_colour));
      }
    });

    const uniqueConditions = [...conditionSet];
    const allColorsArray = [...colorIdSet];

    const firstInvDate = new Date(productDetails.first_inv_date);
    const today = new Date();
    const diffDays = Math.floor((today - firstInvDate) / (1000 * 60 * 60 * 24)) + " days";

    // storages
    const storageMasterCollection = mongoose.connection.collection("storageMaster");
    const storage = await storageMasterCollection
      .aggregate([
        { $match: { model_id: Number(modelId) } },
        {
          $group: {
            _id: "$storage_name",
            storage_id: { $first: "$storage_id" },
          },
        },
        {
          $project: {
            _id: 0,
            storage_name: "$_id",
            storage_id: 1,
          },
        },
      ])
      .toArray();

    // match storage of lowest item
    const matchedStorage = storage.find(
      (s) => s.storage_id === productDetails.storage_id
    );
    productDetails.storage = matchedStorage || null;

    // model details
    const allModelCollection = mongoose.connection.collection("allModel");
    const modelDetails = await allModelCollection
      .aggregate([
        { $match: { model_id: Number(modelId) } },
        { $project: { model_image: 1, model_description: 1, _id: 0 } },
      ])
      .toArray();

    // color of lowest item
    const colorMasterListCollection =
      mongoose.connection.collection("colorMasterList");
    const lowestItemColor = await colorMasterListCollection.findOne({
      color_id: Number(productDetails.item_colour),
    });
    productDetails.color = lowestItemColor;

    // image details
    const modelImageColorListCollection =
      mongoose.connection.collection("modelImageColorList");
    const imageDetails = await modelImageColorListCollection.findOne(
      {
        model_id: Number(modelId),
        color_code: lowestItemColor?.color_code,
      },
      {
        projection: {
          color_code: 1,
          image: 1,
          color_name: 1,
          _id: 0,
          id: 1,
        },
      }
    );
    productDetails.image = imageDetails || null;

    // all colors list
    const colors = await colorMasterListCollection
      .find({ color_id: { $in: allColorsArray } })
      .toArray();

    return res.status(200).json({
      message: "success",
      lowestItem: productDetails,
      conditions: uniqueConditions,
      item_age: diffDays,
      modelDetails: modelDetails,
      branchDetails: branchDetails,
      colors: colors,
      storage: storage,
    });
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
};


const getAllModel = async (req, res, next) => {
  const allModelCollection = mongoose.connection.collection('allModel');

  try {
    const ModelList = await allModelCollection.find({}).toArray();
    if(!ModelList || !ModelList.length > 0){
      return next(new AppError('model not found!', 400));
    }
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
    if(!brandList || !brandList.length > 0){
      return next(new AppError('branch not found!', 400));
    }

    res.status(201).json({
      success: true,
      brandList: brandList
    })
  } catch (err) {
    return next(new AppError(err.message, 400));
  }
}

const uploadJsonDataInDB = async (req, res) => {
  // Use try-finally for robust cleanup of the uploaded file,
  // even if an error occurs during processing.
  let filePath;
  try {
    // Check if a file was uploaded by Multer
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    console.log(req.body)

    const { collectionName } = req.body;

    // The shouldDeleteCollection should be a boolean flag, not a collection name.
    // This is a critical security fix.
    if (!collectionName) {
      return res.status(400).json({ success: false, message: "Collection name required" });
    }

    // Multer provides the full, unique path of the uploaded file via req.file.path
    filePath = req.file.path;

    // Read & parse the JSON file
    let jsonData;
    try {
      const content = await fs.readFile(filePath, "utf-8");
      jsonData = JSON.parse(content);
    } catch (err) {
      // Handle the case where the JSON file is invalid.
      return res.status(400).json({ success: false, message: "Invalid JSON format" });
    }

    // Ensure jsonData is an array for insertMany operation.
    if (!Array.isArray(jsonData)) {
      jsonData = [jsonData];
    }

    const db = mongoose.connection.db;


    // Insert the data into the specified collection
    const collection = db.collection(collectionName);
    const result = await collection.insertMany(jsonData);

    res.status(200).json({
      success: true,
      message: `JSON uploaded successfully to '${collectionName}'`,
      insertedCount: result.insertedCount,
    });
  } catch (err) {
    console.error("Upload JSON Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    // This block ensures the uploaded file is always removed,
    // even if an error occurred during database operations.
    if (filePath) {
      try {
        await fs.rm(filePath);
      } catch (cleanupErr) {
        // Log the cleanup error but don't fail the request.
        console.error("Failed to remove uploaded file:", cleanupErr);
      }
    }
  }
};


export { getHome, searchProducts, productByBranchId, allBranch, getAllOffers, getProductById , productDetails, getRelatedProducts, getAllModel, getAllBrand, uploadJsonDataInDB}