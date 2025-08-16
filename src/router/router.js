import express from 'express';
import { allBranch, getAllOffers, getHome, getProductById, productByBranchId, searchProducts } from '../controller/controller.js';


const router = express.Router();


router.get('/home', getHome);

router.get('/getAllOffers', getAllOffers);

router.post('/searchProducts', searchProducts);

router.post('/getProductById', getProductById);

router.get('/allBranch', allBranch);

router.post('/productByBranchId', productByBranchId);



export default router;
