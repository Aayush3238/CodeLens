const { buildDependencyGraph, getGraphStats: computeStats, invalidateGraphCache } = require("../services/graph");

const getGraph = async (req, res, next) => {
  try {
    const graph = buildDependencyGraph();
    res.json({ graph, stats: computeStats(graph) });
  } catch (error) {
    next(error);
  }
};

const getGraphStats = async (req, res, next) => {
  try {
    const graph = buildDependencyGraph();
    res.json(computeStats(graph));
  } catch (error) {
    next(error);
  }
};

const refreshGraph = async (req, res, next) => {
  try {
    invalidateGraphCache();
    const graph = buildDependencyGraph();
    res.json({ graph, stats: computeStats(graph), refreshed: true });
  } catch (error) {
    next(error);
  }
};

const getNodeDetails = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const graph = buildDependencyGraph();

    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      return res.status(404).json({ error: "Node not found" });
    }

    const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
    const outgoingEdges = graph.edges.filter((e) => e.source === nodeId);

    res.json({
      node,
      dependencies: outgoingEdges.map((e) => ({
        target: e.target,
        type: e.type,
        label: e.label,
      })),
      dependents: incomingEdges.map((e) => ({
        source: e.source,
        type: e.type,
        label: e.label,
      })),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getGraph, getGraphStats, refreshGraph, getNodeDetails };
