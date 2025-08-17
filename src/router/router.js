import express from 'express';
import { allBranch, getAllBrand, getAllModel, getAllOffers, getHome, getProductById, getRelatedProducts, productByBranchId, productDetails, searchProducts } from '../controller/controller.js';


const router = express.Router();


router.get('/home', getHome);

router.get('/getAllOffers', getAllOffers);

router.post('/searchProducts', searchProducts);

router.post('/getProductById', getProductById); 

router.get('/allBranch', allBranch);

router.post('/productByBranchId', productByBranchId);

router.post('/getRelatedProducts', getRelatedProducts)

router.post('/productDetails', productDetails); 

router.get('/getAllModel', getAllModel);

router.get('/getAllBrand', getAllBrand);


export default router;
