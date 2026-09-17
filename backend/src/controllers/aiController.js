const aiService = require("../services/ai");
const prisma = require("../config/db");

const getConversations = async (req, res, next) => {
  try {//to get the user's conversations
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user.id }, 
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const conversation = await prisma.conversation.create({
      data: { userId: req.user.id, title: req.body.title || "New Conversation" },
    });
    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (!conversation || conversation.userId !== req.user.id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    await prisma.message.create({
      data: { conversationId, role: "user", content },
    });

    const allMessages = [
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ];

    const reply = await aiService.chat(allMessages);

    const assistantMessage = await prisma.message.create({
      data: { conversationId, role: "assistant", content: reply },
    });

    res.json({ message: assistantMessage });
  } catch (error) {
    next(error);
  }
};

const chatStream = async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: true },
    });

    if (!conversation || conversation.userId !== req.user.id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    await prisma.message.create({
      data: { conversationId, role: "user", content },
    });

    const allMessages = [
      ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullContent = "";
    for await (const chunk of aiService.chatStream(allMessages)) {
      fullContent += chunk;
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    await prisma.message.create({
      data: { conversationId, role: "assistant", content: fullContent },
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
};

const generateRevisionPlan = async (req, res, next) => {
  try {
    const { weakTopics, planType } = req.body;
    const plan = await aiService.generateRevisionPlan(weakTopics, planType);

    const revisionPlan = await prisma.revisionPlan.create({
      data: {
        userId: req.user.id,
        type: planType,
        items: {
          create: plan.days.map((d) => ({
            day: d.day,
            topic: d.topic,
            problems: d.problems,
            estimatedTime: d.estimatedTime,
          })),
        },
      },
      include: { items: true },
    });

    res.json({ plan: revisionPlan });
  } catch (error) {
    next(error);
  }
};

const getRevisionPlans = async (req, res, next) => {
  try {
    const plans = await prisma.revisionPlan.findMany({
      where: { userId: req.user.id },
      include: { items: { orderBy: { day: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    res.json({ plans });
  } catch (error) {
    next(error);
  }
};

const explainCode = async (req, res, next) => {
  try {
    const { code, language, question } = req.body;
    const result = await aiService.explainCode(code, language, question);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation || conversation.userId !== req.user.id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    await prisma.message.deleteMany({ where: { conversationId: id } });
    await prisma.conversation.delete({ where: { id } });

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    next(error);
  }
};

const renameConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ message: "Title is required" });
    }

    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation || conversation.userId !== req.user.id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { title: title.trim() },
    });

    res.json({ conversation: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  createConversation,
  sendMessage,
  chatStream,
  generateRevisionPlan,
  getRevisionPlans,
  explainCode,
  deleteConversation,
  renameConversation,
};
