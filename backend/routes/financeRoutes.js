const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listStaffFinance, upsertRates,
  getMyFinance, listPayments, createPayment, deletePayment, getMyPayments,
  updateExtClientFee,
} = require("../controllers/financeController");

const router = express.Router();
const CEO = requireRole("gym_owner");
const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist", "receptionist", "intern");

// CEO — gestão financeira
router.get("/staff", requireAuth, CEO, listStaffFinance);
router.put("/rates/:staffId", requireAuth, CEO, upsertRates);

// CEO — pagamentos mensais  (antes de /:id para não conflituar)
router.get("/payments", requireAuth, CEO, listPayments);
router.post("/payments", requireAuth, CEO, createPayment);
router.delete("/payments/:id", requireAuth, CEO, deletePayment);

// Staff — view própria
router.get("/my", requireAuth, STAFF, getMyFinance);
router.get("/my/payments", requireAuth, STAFF, getMyPayments);
// PT — define o valor mensal de um cliente externo seu
router.put("/my/ext-client/:eccId/fee", requireAuth, STAFF, updateExtClientFee);

module.exports = router;
