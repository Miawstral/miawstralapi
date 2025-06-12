import { Router } from "express"; 
import * as stopsController from "./stops.controller"


const router = Router(); 

router.get('/', stopsController.getAll); 
router.get("/:id", stopsController.getById); 

export default router; 

