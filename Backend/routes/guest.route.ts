import { Router } from "express";
import { reflectionOffer, reflectionDecline } from "../controller/guest.controller";

const router = Router();

router.get("/guest/reflection-offer",     reflectionOffer);
router.post("/guest/reflection-decline",  reflectionDecline);

export default router;
