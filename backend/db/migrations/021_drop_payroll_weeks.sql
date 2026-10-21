-- 021: remove a tabela payroll_weeks (resumo semanal manual de horas).
-- Nunca chegou a ter interface do CEO para a preencher — o fluxo real de
-- pagamento (monthly_payments) já deriva as horas diretamente de
-- staff_attendance, sem precisar deste passo semanal manual. Ficava como
-- código morto: endpoints inteiros (listWeeks/upsertWeek/confirmWeek)
-- que o frontend nunca chamava.
DROP TABLE IF EXISTS payroll_weeks;
