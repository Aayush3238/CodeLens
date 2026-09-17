const express = require("express");
const { getGraph, getGraphStats, refreshGraph, getNodeDetails } = require("../controllers/graphController");

const router = express.Router();

router.get("/", getGraph);
router.get("/stats", getGraphStats);
router.post("/refresh", refreshGraph);
router.get("/node/:nodeId(*)", getNodeDetails);

module.exports = router;
