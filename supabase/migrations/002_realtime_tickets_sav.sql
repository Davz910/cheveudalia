-- Activer le temps réel sur tickets_sav (Dashboard Supabase > Database > Replication si besoin)
ALTER PUBLICATION supabase_realtime ADD TABLE tickets_sav;
