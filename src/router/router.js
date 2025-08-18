import express from 'express';
import { allBranch, getAllBrand, getAllModel, getAllOffers, getHome, getProductById, getRelatedProducts, productByBranchId, productDetails, searchProducts, uploadJsonDataInDB } from '../controller/controller.js';
// import upload from '../middleware/multer.js';
import multer from 'multer'
const upload = multer({ dest: '../../uploads/' })


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

router.post('/uploadJsonDataInDB', upload.single('file'), uploadJsonDataInDB);


export default router;
