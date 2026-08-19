"use client";

import { useState, useMemo } from "react";
import { 
  Banknote, 
  Calendar, 
  Search, 
  Plus, 
  History, 
  Printer, 
  Trash2, 
  X, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Gift,
  FileText
} from "lucide-react";
import { getSalaryOverview, addSalaryTransaction, deleteSalaryTransaction, getSalaryUserHistory } from "@/app/actions";

interface SalariesClientProps {
  initialMode: "MONTHLY" | "WEEKLY" | "CUSTOM";
  initialDate: string;
  initialLabel: string;
  initialData: any[];
  initialKpis: {
    totalEarned: number;
    totalAdvances: number;
    totalBonuses: number;
    totalRemaining: number;
  };
  initialCompanyName?: string;
  initialCurrency?: string;
}

export default function SalariesClient({ initialMode, initialDate, initialLabel, initialData, initialKpis, initialCompanyName, initialCurrency }: SalariesClientProps) {
  const companyName = initialCompanyName || "Mon Entreprise";
  const currency = initialCurrency || "DH";
  const [periodMode, setPeriodMode] = useState<"MONTHLY" | "WEEKLY" | "CUSTOM">(
    (initialMode as "MONTHLY" | "WEEKLY" | "CUSTOM") || "MONTHLY"
  );
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [periodLabel, setPeriodLabel] = useState<string>(initialLabel);
  const [frequencyFilter, setFrequencyFilter] = useState<"ALL" | "WEEKLY" | "MONTHLY">("ALL");

  const [data, setData] = useState<any[]>(initialData);
  const [kpis, setKpis] = useState(initialKpis);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Add Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState<any>(null);
  const [txnType, setTxnType] = useState<"ADVANCE" | "ACOMPTE" | "BONUS" | "DEDUCTION" | "FINAL_PAY">("ADVANCE");
  const [txnAmount, setTxnAmount] = useState<string>("");
  const [txnDate, setTxnDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [txnPeriodDate, setTxnPeriodDate] = useState<string>("");
  const [txnPeriodStartDate, setTxnPeriodStartDate] = useState<string>("");
  const [txnPeriodEndDate, setTxnPeriodEndDate] = useState<string>("");
  const [txnMethod, setTxnMethod] = useState<"CASH" | "BANK_TRANSFER" | "CHECK">("CASH");
  const [txnRef, setTxnRef] = useState<string>("");
  const [txnNotes, setTxnNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string>("");

  // History & Print Receipt Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyUser, setHistoryUser] = useState<any>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<"PAYMENTS" | "ADJUSTMENTS">("PAYMENTS");
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);

  // Print receipt active item state
  const [receiptTxn, setReceiptTxn] = useState<any>(null);

  // Checkbox selection state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Batch Pay Modal State
  const [isBatchPayModalOpen, setIsBatchPayModalOpen] = useState<boolean>(false);
  const [batchPayMethod, setBatchPayMethod] = useState<"BANK_TRANSFER" | "CASH" | "CHECK">("BANK_TRANSFER");
  const [batchPayRef, setBatchPayRef] = useState<string>("");
  const [batchPayDate, setBatchPayDate] = useState<string>("");
  const [batchPayNotes, setBatchPayNotes] = useState<string>("");

  // Batch advance modal state
  const [isBatchAdvanceModalOpen, setIsBatchAdvanceModalOpen] = useState<boolean>(false);
  const [batchAdvanceAmount, setBatchAdvanceAmount] = useState<string>("");

  // Fiche de Paie modal state
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState<boolean>(false);
  const [payslipUsers, setPayslipUsers] = useState<any[]>([]);

  // Global Payout Order print modal state
  const [isGlobalPayoutModalOpen, setIsGlobalPayoutModalOpen] = useState<boolean>(false);

  // Adjustment Modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [adjustUser, setAdjustUser] = useState<any>(null);
  const [targetNetInput, setTargetNetInput] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("Arrondi de solde au supérieur");

  const fetchOverview = async (mode: "MONTHLY" | "WEEKLY" | "CUSTOM", dateStr: string, endDateStr?: string) => {
    setIsLoading(true);
    try {
      const res = await getSalaryOverview(mode, dateStr, endDateStr);
      if (res.success) {
        setData(res.data || []);
        setKpis(res.kpis || { totalEarned: 0, totalAdvances: 0, totalBonuses: 0, totalRemaining: 0 });
        if (res.periodLabel) setPeriodLabel(res.periodLabel);
        if (res.dateValue) setSelectedDate(res.dateValue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: "MONTHLY" | "WEEKLY" | "CUSTOM") => {
    setPeriodMode(newMode);
    const now = new Date();
    if (newMode === "MONTHLY") {
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      fetchOverview("MONTHLY", monthStr);
    } else if (newMode === "WEEKLY") {
      const todayStr = now.toISOString().split("T")[0]!;
      fetchOverview("WEEKLY", todayStr);
    } else {
      // CUSTOM: Default to last 7 days
      const endD = new Date();
      const startD = new Date();
      startD.setDate(endD.getDate() - 6);
      const sStr = startD.toISOString().split("T")[0]!;
      const eStr = endD.toISOString().split("T")[0]!;
      setSelectedDate(sStr);
      setCustomEndDate(eStr);
      fetchOverview("CUSTOM", sStr, eStr);
    }
  };

  const handleDateChange = (dateVal: string) => {
    setSelectedDate(dateVal);
    fetchOverview(periodMode, dateVal, customEndDate);
  };

  const handleCustomEndDateChange = (endDateVal: string) => {
    setCustomEndDate(endDateVal);
    fetchOverview("CUSTOM", selectedDate, endDateVal);
  };

  const setPreset = (preset: "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth") => {
    const now = new Date();
    if (preset === "thisWeek") {
      setPeriodMode("WEEKLY");
      fetchOverview("WEEKLY", now.toISOString().split("T")[0]!);
    } else if (preset === "lastWeek") {
      const lastWk = new Date();
      lastWk.setDate(now.getDate() - 7);
      setPeriodMode("WEEKLY");
      fetchOverview("WEEKLY", lastWk.toISOString().split("T")[0]!);
    } else if (preset === "thisMonth") {
      setPeriodMode("MONTHLY");
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      fetchOverview("MONTHLY", monthStr);
    } else if (preset === "lastMonth") {
      const lastMo = new Date();
      lastMo.setMonth(now.getMonth() - 1);
      setPeriodMode("MONTHLY");
      const monthStr = `${lastMo.getFullYear()}-${String(lastMo.getMonth() + 1).padStart(2, "0")}`;
      fetchOverview("MONTHLY", monthStr);
    }
  };

  const handleOpenAddModal = (user?: any) => {
    const today = new Date().toISOString().split("T")[0];
    const startP = (selectedDate && selectedDate.includes("-"))
      ? (selectedDate.length === 7 ? `${selectedDate}-01` : selectedDate)
      : today;
    const endP = customEndDate || startP;

    const targetUser = user || (data.length > 0 ? data[0] : null);
    setSelectedUserForAdd(targetUser);
    setTxnType("FINAL_PAY");
    if (targetUser && targetUser.netPayable > 0) {
      setTxnAmount(targetUser.netPayable.toFixed(2));
    } else {
      setTxnAmount("");
    }
    setTxnDate(today);
    setTxnPeriodDate(startP);
    setTxnPeriodStartDate(startP);
    setTxnPeriodEndDate(endP);
    setTxnMethod("BANK_TRANSFER");
    setTxnRef("");
    setTxnNotes("");
    setModalError("");
    setIsAddModalOpen(true);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForAdd) return;

    const amountNum = parseFloat(txnAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    const targetUser = data.find(u => u.userId === (selectedUserForAdd.userId || selectedUserForAdd.id)) || selectedUserForAdd;
    const calculatedNet = targetUser?.netPayable || 0;
    const diff = amountNum - calculatedNet;

    try {
      const res = await addSalaryTransaction({
        userId: targetUser.userId || targetUser.id,
        type: txnType,
        amount: amountNum,
        dateStr: txnDate,
        periodDateStr: txnPeriodStartDate || txnPeriodDate || selectedDate,
        periodStartDateStr: txnPeriodStartDate,
        periodEndDateStr: txnPeriodEndDate,
        method: txnMethod,
        reference: txnRef,
        notes: txnNotes
      });

      if (!res.success) {
        setModalError(res.error || "Échec de l'enregistrement.");
        setIsSubmitting(false);
        return;
      }

      // Automatically apply bonus/deduction adjustment if entered amount differs from calculated net for FINAL_PAY
      if (txnType === "FINAL_PAY" && Math.abs(diff) >= 0.01) {
        if (diff > 0) {
          await addSalaryTransaction({
            userId: targetUser.userId || targetUser.id,
            type: "BONUS",
            amount: Number(diff.toFixed(2)),
            dateStr: txnDate,
            periodDateStr: txnPeriodStartDate || txnPeriodDate || selectedDate,
            periodStartDateStr: txnPeriodStartDate,
            periodEndDateStr: txnPeriodEndDate,
            method: txnMethod,
            notes: `Arrondi de solde / Prime automatique (+${diff.toFixed(2)} ${currency})`
          });
        } else {
          await addSalaryTransaction({
            userId: targetUser.userId || targetUser.id,
            type: "DEDUCTION",
            amount: Number(Math.abs(diff).toFixed(2)),
            dateStr: txnDate,
            periodDateStr: txnPeriodStartDate || txnPeriodDate || selectedDate,
            periodStartDateStr: txnPeriodStartDate,
            periodEndDateStr: txnPeriodEndDate,
            method: txnMethod,
            notes: `Ajustement / Déduction automatique (-${Math.abs(diff).toFixed(2)} ${currency})`
          });
        }
      }

      setIsAddModalOpen(false);
      fetchOverview(periodMode, selectedDate, customEndDate);
    } catch (err) {
      setModalError("Erreur de communication avec le serveur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistoryModal = async (user: any) => {
    setHistoryUser(user);
    setHistoryTab("PAYMENTS");
    setIsHistoryLoading(true);
    setReceiptTxn(null);
    setIsHistoryModalOpen(true);

    try {
      const res = await getSalaryUserHistory(user.userId, selectedDate);
      if (res.success) {
        setHistoryList(res.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleDeleteTxn = async (txnId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet enregistrement de versement ?")) return;

    try {
      const res = await deleteSalaryTransaction(txnId);
      if (res.success) {
        setHistoryList(prev => prev.filter(t => t.id !== txnId));
        fetchOverview(periodMode, selectedDate, customEndDate);
      }
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const filteredData = data.filter(u => {
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(query) || String(u.zktecoUserId).includes(query);

    let matchesFreq = true;
    if (frequencyFilter === "WEEKLY") {
      matchesFreq = u.paymentFrequency === "WEEKLY";
    } else if (frequencyFilter === "MONTHLY") {
      matchesFreq = u.paymentFrequency === "MONTHLY" || !u.paymentFrequency;
    }

    return matchesSearch && matchesFreq;
  });

  const filteredKpis = useMemo(() => {
    const totalEarned = filteredData.reduce((acc, u) => acc + (u.earnedSalary || 0), 0);
    const totalAdvances = filteredData.reduce((acc, u) => acc + (u.advances || 0), 0);
    const totalBonuses = filteredData.reduce((acc, u) => acc + (u.bonuses || 0), 0);
    const totalFinalPaid = filteredData.reduce((acc, u) => acc + (u.finalPaid || 0), 0);
    const totalRemaining = filteredData.reduce((acc, u) => acc + Math.max(0, u.netPayable || 0), 0);

    return {
      totalEarned: Number(totalEarned.toFixed(2)),
      totalAdvances: Number(totalAdvances.toFixed(2)),
      totalBonuses: Number(totalBonuses.toFixed(2)),
      totalFinalPaid: Number(totalFinalPaid.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
    };
  }, [filteredData]);

  const isAllSelected = filteredData.length > 0 && selectedUserIds.length === filteredData.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredData.map(u => u.userId));
    }
  };

  const handleToggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleOpenBatchPayModal = () => {
    const targets = data.filter(u => selectedUserIds.includes(u.userId) && u.netPayable > 0);
    if (targets.length === 0) {
      alert("Aucun des employés sélectionnés n'a de solde net à régler.");
      return;
    }

    const activePeriodDate = (selectedDate && selectedDate.includes("-"))
      ? (selectedDate.length === 7 ? `${selectedDate}-15` : selectedDate)
      : new Date().toISOString().split("T")[0];

    setBatchPayMethod("BANK_TRANSFER");
    setBatchPayRef("");
    setBatchPayDate(activePeriodDate);
    setBatchPayNotes(`Règlement Solde Final - ${periodLabel}`);
    setIsBatchPayModalOpen(true);
  };

  const handleConfirmBatchPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const targets = data.filter(u => selectedUserIds.includes(u.userId) && u.netPayable > 0);
    if (targets.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const u of targets) {
        await addSalaryTransaction({
          userId: u.userId,
          type: "FINAL_PAY",
          amount: u.netPayable,
          dateStr: batchPayDate,
          method: batchPayMethod,
          reference: batchPayRef,
          notes: batchPayNotes
        });
      }
      setIsBatchPayModalOpen(false);
      setSelectedUserIds([]);
      fetchOverview(periodMode, selectedDate, customEndDate);
    } catch (err) {
      alert("Erreur lors de la validation des virement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBatchAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(batchAdvanceAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Veuillez saisir un montant d'avance valide.");
      return;
    }

    const targets = data.filter(u => selectedUserIds.includes(u.userId));
    if (targets.length === 0) return;

    setIsSubmitting(true);
    const activePeriodDate = (selectedDate && selectedDate.includes("-"))
      ? (selectedDate.length === 7 ? `${selectedDate}-15` : selectedDate)
      : new Date().toISOString().split("T")[0];

    try {
      for (const u of targets) {
        await addSalaryTransaction({
          userId: u.userId,
          type: "ADVANCE",
          amount: amountNum,
          dateStr: activePeriodDate,
          method: "CASH",
          notes: `Avance groupée - ${periodLabel}`
        });
      }
      setIsBatchAdvanceModalOpen(false);
      setBatchAdvanceAmount("");
      setSelectedUserIds([]);
      fetchOverview(periodMode, selectedDate, customEndDate);
    } catch (err) {
      alert("Erreur lors de la création de l'avance groupée.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPayslipForSelected = () => {
    const targets = data.filter(u => selectedUserIds.includes(u.userId));
    if (targets.length === 0) return;
    setPayslipUsers(targets);
    setIsPayslipModalOpen(true);
  };

  const handleOpenPayslipSingle = (user: any) => {
    setPayslipUsers([user]);
    setIsPayslipModalOpen(true);
  };

  const handleOpenAdjustModal = (user: any) => {
    setAdjustUser(user);
    setTargetNetInput(user.netPayable.toString());
    setAdjustReason("Arrondi de solde au supérieur");
    setModalError("");
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUser) return;

    const targetVal = parseFloat(targetNetInput);
    if (isNaN(targetVal) || targetVal < 0) {
      setModalError("Veuillez saisir un solde net cible valide.");
      return;
    }

    const currentNet = adjustUser.netPayable;
    const diff = targetVal - currentNet;

    if (Math.abs(diff) < 0.01) {
      setIsAdjustModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    const activePeriodDate = (selectedDate && selectedDate.includes("-"))
      ? (selectedDate.length === 7 ? `${selectedDate}-01` : selectedDate)
      : new Date().toISOString().split("T")[0];

    try {
      if (diff > 0) {
        const res = await addSalaryTransaction({
          userId: adjustUser.userId,
          type: "BONUS",
          amount: Number(diff.toFixed(2)),
          dateStr: activePeriodDate,
          periodDateStr: activePeriodDate,
          method: "CASH",
          notes: `Ajustement / ${adjustReason} (+${diff.toFixed(2)} ${currency})`
        });
        if (!res.success) {
          setModalError(res.error || "Échec de l'enregistrement.");
          setIsSubmitting(false);
          return;
        }
      } else {
        const absDiff = Math.abs(diff);
        const res = await addSalaryTransaction({
          userId: adjustUser.userId,
          type: "DEDUCTION",
          amount: Number(absDiff.toFixed(2)),
          dateStr: activePeriodDate,
          periodDateStr: activePeriodDate,
          method: "CASH",
          notes: `Ajustement / ${adjustReason} (-${absDiff.toFixed(2)} ${currency})`
        });
        if (!res.success) {
          setModalError(res.error || "Échec de l'enregistrement.");
          setIsSubmitting(false);
          return;
        }
      }

      setIsAdjustModalOpen(false);
      fetchOverview(periodMode, selectedDate, customEndDate);
    } catch (err) {
      setModalError("Erreur de communication avec le serveur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchRoundUp = async (step: number = 10) => {
    const targets = data.filter(u => selectedUserIds.includes(u.userId) && u.netPayable > 0);
    if (targets.length === 0) {
      alert("Aucun employé avec solde net à arrondir.");
      return;
    }

    if (!confirm(`Voulez-vous arrondir au supérieur (multiple de ${step} ${currency}) le solde net de ${targets.length} employé(s) ?`)) return;

    setIsLoading(true);
    const activePeriodDate = (selectedDate && selectedDate.includes("-"))
      ? (selectedDate.length === 7 ? `${selectedDate}-15` : selectedDate)
      : new Date().toISOString().split("T")[0];

    try {
      for (const u of targets) {
        const roundedNet = Math.ceil(u.netPayable / step) * step;
        const diff = roundedNet - u.netPayable;
        if (diff > 0.01) {
          await addSalaryTransaction({
            userId: u.userId,
            type: "BONUS",
            amount: Number(diff.toFixed(2)),
            dateStr: activePeriodDate,
            method: "CASH",
            notes: `Ajustement / Arrondi au supérieur (${u.netPayable.toFixed(2)} ${currency} -> ${roundedNet} ${currency})`
          });
        }
      }
      setSelectedUserIds([]);
      fetchOverview(periodMode, selectedDate, customEndDate);
    } catch (err) {
      alert("Erreur lors de l'arrondi groupé.");
    } finally {
      setIsLoading(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case "CASH":
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-medium">Espèces</span>;
      case "BANK_TRANSFER":
        return <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded text-[11px] font-medium">Virement</span>;
      case "CHECK":
        return <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded text-[11px] font-medium">Chèque</span>;
      default:
        return <span className="bg-foreground/10 text-foreground/70 px-2 py-0.5 rounded text-[11px] font-medium">{method}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "ADVANCE":
        return <span className="bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded text-xs font-semibold">Avance sur Salaire</span>;
      case "ACOMPTE":
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-semibold">Acompte</span>;
      case "BONUS":
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-semibold">+ Prime / Gratification</span>;
      case "DEDUCTION":
        return <span className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded text-xs font-semibold">- Retenue / Pénalité</span>;
      case "FINAL_PAY":
        return <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-xs font-semibold">Règlement Solde Final</span>;
      default:
        return <span className="bg-foreground/10 text-foreground/70 px-2 py-0.5 rounded text-xs font-semibold">{type}</span>;
    }
  };

  const handleSmartPrint = (docType: "PAYSLIP" | "GLOBAL_ORDER") => {
    const originalTitle = document.title;
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStamp = now.toTimeString().slice(0, 8).replace(/:/g, "");
    const cleanPeriod = (periodLabel || "Periode").replace(/[^a-zA-Z0-9]/g, "_");

    let smartTitle = "";
    if (docType === "PAYSLIP") {
      if (payslipUsers.length === 1) {
        const u = payslipUsers[0];
        smartTitle = `Fiche_de_Paie_${u.lastName.toUpperCase()}_${u.firstName}_${cleanPeriod}_${dateStamp}_${timeStamp}`;
      } else {
        smartTitle = `Fiches_de_Paie_${payslipUsers.length}_Salaries_${cleanPeriod}_${dateStamp}_${timeStamp}`;
      }
    } else {
      smartTitle = `Ordre_Paiement_Global_${payslipUsers.length}_Salaries_${cleanPeriod}_${dateStamp}_${timeStamp}`;
    }

    document.title = smartTitle;
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  return (
    <>
      {/* Main Salaries Page Content - Hidden completely during print */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:hidden">
      {/* Top Header Section */}
      <div className="space-y-5">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
                <Banknote className="w-7 h-7 text-primary" />
                Gestion des Salaires & Avances
              </h1>
              {periodLabel && (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold text-xs">
                  {periodLabel}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-foreground/60 mt-1">
              Gérez les versements, les avances sur salaire et consultez le solde net à verser à vos équipes.
            </p>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="self-start sm:self-auto px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nouveau Versement / Avance
          </button>
        </div>

        {/* Unified Control & Filter Toolbar */}
        <div className="glass-panel p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-border/80 rounded-2xl shadow-sm">
          {/* Mode Switcher & Date Picker */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-surface p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => handleModeChange("MONTHLY")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodMode === "MONTHLY"
                    ? "bg-primary text-white shadow-sm font-bold"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                🗓️ Vue Mensuelle
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("WEEKLY")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodMode === "WEEKLY"
                    ? "bg-primary text-white shadow-sm font-bold"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                📅 Vue Hebdomadaire
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("CUSTOM")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  periodMode === "CUSTOM"
                    ? "bg-primary text-white shadow-sm font-bold"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                🎯 Plage Personnalisée
              </button>
            </div>

            {periodMode === "CUSTOM" ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-surface border border-border rounded-xl px-2.5 py-1.5 gap-1.5">
                  <span className="text-[11px] font-bold text-foreground/50 uppercase">Du:</span>
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent border-none text-foreground font-bold text-xs focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center bg-surface border border-border rounded-xl px-2.5 py-1.5 gap-1.5">
                  <span className="text-[11px] font-bold text-foreground/50 uppercase">Au:</span>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => handleCustomEndDateChange(e.target.value)}
                    className="bg-transparent border-none text-foreground font-bold text-xs focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center bg-surface border border-border rounded-xl px-3 py-1.5 gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                {periodMode === "MONTHLY" ? (
                  <input 
                    type="month"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent border-none text-foreground font-semibold text-xs sm:text-sm focus:outline-none cursor-pointer"
                  />
                ) : (
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="bg-transparent border-none text-foreground font-semibold text-xs sm:text-sm focus:outline-none cursor-pointer"
                  />
                )}
              </div>
            )}
          </div>

          {/* Quick Presets Bar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
            <span className="text-xs text-foreground/50 font-medium mr-1 hidden sm:inline">Raccourcis :</span>
            <button 
              type="button" 
              onClick={() => setPreset("thisWeek")} 
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-foreground/80 text-xs font-semibold border border-border transition-colors cursor-pointer"
            >
              Cette Semaine
            </button>
            <button 
              type="button" 
              onClick={() => setPreset("lastWeek")} 
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-foreground/80 text-xs font-semibold border border-border transition-colors cursor-pointer"
            >
              Semaine Dernière
            </button>
            <button 
              type="button" 
              onClick={() => setPreset("thisMonth")} 
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-foreground/80 text-xs font-semibold border border-border transition-colors cursor-pointer"
            >
              Ce Mois-ci
            </button>
            <button 
              type="button" 
              onClick={() => setPreset("lastMonth")} 
              className="px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-hover text-foreground/80 text-xs font-semibold border border-border transition-colors cursor-pointer"
            >
              Le Mois Dernier
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-panel p-4 border-primary/20 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider mb-1">Masse Salariale Gagnée</p>
              <p className="text-xl font-bold text-foreground">
                {filteredKpis.totalEarned.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-foreground/50 mt-2">Pointages ZKTeco ({periodLabel})</p>
        </div>

        <div className="glass-panel p-4 border-warning/30 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider mb-1">Total Avances & Acomptes</p>
              <p className="text-xl font-bold text-warning">
                {filteredKpis.totalAdvances.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-warning/10 text-warning">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-foreground/50 mt-2">Acomptes mi-mois sur cette période</p>
        </div>

        <div className="glass-panel p-4 border-emerald-500/30 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider mb-1">Total Primes Accordées</p>
              <p className="text-xl font-bold text-emerald-500">
                {filteredKpis.totalBonuses.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-foreground/50 mt-2">Gratifications et arrondis de solde</p>
        </div>

        <div className="glass-panel p-4 border-blue-500/30 bg-blue-500/5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider mb-1">Total Déjà Versé (Payé)</p>
              <p className="text-xl font-black text-blue-600">
                {filteredKpis.totalFinalPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-blue-600/80 mt-2 font-medium">Virements & règlements décaissés</p>
        </div>

        <div className="glass-panel p-4 border-accent/40 bg-accent/5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold text-accent uppercase tracking-wider mb-1">Reste à Payer (Net)</p>
              <p className="text-xl font-black text-accent">
                {filteredKpis.totalRemaining.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-accent/20 text-accent">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[10px] text-foreground/60 mt-2 font-medium">Solde restant à régler (filtré)</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input 
            type="text"
            placeholder="Rechercher par nom d'employé ou ID ZKTeco..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => {
              const targets = selectedUserIds.length > 0 ? data.filter(u => selectedUserIds.includes(u.userId)) : filteredData;
              setPayslipUsers(targets);
              setIsGlobalPayoutModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Ordre de Paiement (PDF)
          </button>

          <select
            value={frequencyFilter}
            onChange={(e: any) => setFrequencyFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="ALL">Tout le personnel</option>
            <option value="WEEKLY">Salariés Hebdomadaires (Weekly)</option>
            <option value="MONTHLY">Salariés Mensuels (Monthly)</option>
          </select>

          <div className="text-xs text-foreground/50 font-medium whitespace-nowrap">
            {filteredData.length} employé(s)
          </div>
        </div>
      </div>

      {/* Main Employee Salary Ledger Table */}
      <div className="glass-panel overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface/50 text-xs uppercase tracking-wider text-foreground/50 border-b border-border">
                <th className="p-4 font-semibold text-center w-10">
                  <input 
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                  />
                </th>
                <th className="p-4 font-semibold">ID ZKTeco</th>
                <th className="p-4 font-semibold">Employé</th>
                <th className="p-4 font-semibold">Shift / Taux</th>
                <th className="p-4 font-semibold text-center">Jrs / Heures</th>
                <th className="p-4 font-semibold text-right">Salaire Gagné (Brut)</th>
                <th className="p-4 font-semibold text-right text-warning">Avances ({currency})</th>
                <th className="p-4 font-semibold text-right text-emerald-500">Primes ({currency})</th>
                <th className="p-4 font-semibold text-right text-blue-500">Déjà Versé ({currency})</th>
                <th className="p-4 font-semibold text-right text-accent">Reste à Payer ({currency})</th>
                <th className="p-4 font-semibold text-center">Statut</th>
                <th className="p-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-foreground/50">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Chargement des données de paie...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-foreground/50">
                    Aucun employé trouvé pour cette sélection.
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.userId} className={`hover:bg-surface-hover/30 transition-colors ${selectedUserIds.includes(row.userId) ? 'bg-primary/5' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox"
                        checked={selectedUserIds.includes(row.userId)}
                        onChange={() => handleToggleSelectUser(row.userId)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="p-4 font-bold text-foreground/80">{row.zktecoUserId}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs">
                          {row.firstName[0]}{row.lastName[0]}
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">{row.lastName.replace(/_/g, ' ').toUpperCase()}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-foreground/60">{row.firstName.replace(/_/g, ' ')}</span>
                            {row.paymentFrequency === "WEEKLY" ? (
                              <span className="text-[9px] bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                Hebdomadaire
                              </span>
                            ) : (
                              <span className="text-[9px] bg-foreground/10 text-foreground/60 border border-border px-1.5 py-0.2 rounded font-medium uppercase tracking-wider">
                                Mensuel
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded font-medium block w-fit mb-0.5">
                        {row.shiftName}
                      </span>
                      <span className="text-[11px] text-foreground/50 font-semibold">{row.hourlyRate} {currency}/h</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-xs font-bold text-foreground block">{row.daysWorked} jours</span>
                      <span className="text-[11px] text-foreground/50">{row.totalHours} h</span>
                    </td>
                    <td className="p-4 text-right font-semibold text-foreground">
                      {row.earnedSalary.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </td>
                    <td className="p-4 text-right">
                      {row.advances > 0 ? (
                        <button
                          onClick={() => handleOpenHistoryModal(row)}
                          className="font-bold text-warning hover:underline cursor-pointer"
                        >
                          -{row.advances.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </button>
                      ) : (
                        <span className="text-foreground/40 text-xs">0,00 {currency}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {row.bonuses > 0 ? (
                        <span className="font-bold text-emerald-500">
                          +{row.bonuses.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </span>
                      ) : (
                        <span className="text-foreground/40 text-xs">0,00 {currency}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {row.finalPaid > 0 ? (
                        <button
                          onClick={() => handleOpenHistoryModal(row)}
                          className="font-bold text-blue-500 hover:underline cursor-pointer"
                          title="Voir les réglements déjà effectués"
                        >
                          {row.finalPaid.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </button>
                      ) : (
                        <span className="text-foreground/40 text-xs">0,00 {currency}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className={`font-black px-2.5 py-1 rounded-lg text-sm border inline-block ${
                          row.netPayable <= 0 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : row.finalPaid > 0
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-sm'
                            : 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                        }`}>
                          {row.netPayable.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAdjustModal(row)}
                          title={`Ajuster / Arrondir le solde versé (ex: 641.64 ${currency} -> 650 ${currency})`}
                          className="p-1 rounded-md bg-surface hover:bg-surface-hover text-foreground/60 hover:text-primary border border-border transition-colors cursor-pointer text-xs"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {row.status === "PAYE" ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Payé (Total)
                        </span>
                      ) : row.status === "PARTIEL" ? (
                        <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" /> Payé Partiel
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-foreground/10 text-foreground/60 border border-border px-2.5 py-1 rounded-full text-xs font-semibold">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenAddModal(row)}
                          title="Ajouter un versement / avance"
                          className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenPayslipSingle(row)}
                          title="Imprimer Fiche de Paie (Bulletin)"
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-colors cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenHistoryModal(row)}
                          title="Voir l'historique et reçus"
                          className="p-1.5 rounded-lg bg-surface hover:bg-surface-hover text-foreground/75 hover:text-foreground border border-border transition-colors cursor-pointer"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating / Sticky Batch Actions Bar */}
      {selectedUserIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-6 border border-border">
          <span className="font-bold text-xs bg-primary text-white px-2.5 py-1 rounded-lg">
            {selectedUserIds.length} sélectionné(s)
          </span>

          <button
            onClick={handleOpenBatchPayModal}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            💰 Payer Solde Final
          </button>

          <button
            onClick={handleOpenPayslipForSelected}
            className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            📄 Fiches de Paie ({selectedUserIds.length})
          </button>

          <button
            onClick={() => {
              const targets = data.filter(u => selectedUserIds.includes(u.userId));
              setPayslipUsers(targets);
              setIsGlobalPayoutModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            🖨️ Ordre de Paiement PDF
          </button>

          <button
            onClick={() => setSelectedUserIds([])}
            className="text-xs text-background/70 hover:text-background font-medium ml-2 cursor-pointer"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Modal 1: Add Payment / Advance */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg p-6 space-y-5 border-border relative">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-foreground/50 hover:text-foreground rounded-lg hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Banknote className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Enregistrer un Versement</h2>
                <p className="text-xs text-foreground/60">Ajouter une avance, un acompte, une prime ou un versement solde.</p>
              </div>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                  Employé Salarié
                </label>
                <select
                  value={selectedUserForAdd?.userId || selectedUserForAdd?.id || ""}
                  onChange={(e) => {
                    const u = data.find(item => item.userId === e.target.value);
                    if (u) setSelectedUserForAdd(u);
                  }}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  {data.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.lastName.replace(/_/g, ' ').toUpperCase()} {u.firstName.replace(/_/g, ' ')} (Net restant: {u.netPayable.toFixed(2)} {currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Type of Transaction */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Type d'Opération
                  </label>
                  <select
                    value={txnType}
                    onChange={(e: any) => {
                      const newType = e.target.value;
                      setTxnType(newType);
                      if (newType === "FINAL_PAY" && selectedUserForAdd && selectedUserForAdd.netPayable > 0) {
                        setTxnAmount(selectedUserForAdd.netPayable.toFixed(2));
                      }
                    }}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="ADVANCE">Avance sur Salaire</option>
                    <option value="ACOMPTE">Acompte Mi-Mois</option>
                    <option value="BONUS">Prime / Gratification (+)</option>
                    <option value="DEDUCTION">Retenue / Pénalité (-)</option>
                    <option value="FINAL_PAY">Règlement Solde Final</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Montant ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="ex: 500.00"
                    value={txnAmount}
                    onChange={(e) => setTxnAmount(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Date Range for Period ("Les jours de ce virement") */}
              <div className="p-3.5 bg-surface/50 border border-border rounded-xl space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-primary flex items-center justify-between">
                  <span>📅 Période du Travail Concerné ("Les jours de ce virement")</span>
                  <span className="text-[10px] text-foreground/50 font-normal lowercase">plage modifiable</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground/70 mb-1">Du (Date Début)</label>
                    <input
                      type="date"
                      required
                      value={txnPeriodStartDate}
                      onChange={(e) => setTxnPeriodStartDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground/70 mb-1">Au (Date Fin)</label>
                    <input
                      type="date"
                      required
                      value={txnPeriodEndDate}
                      onChange={(e) => setTxnPeriodEndDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Live adjustment calculation helper when amount is entered for FINAL_PAY */}
              {(() => {
                if (txnType !== "FINAL_PAY" || !selectedUserForAdd) return null;
                const targetUser = data.find(u => u.userId === (selectedUserForAdd.userId || selectedUserForAdd.id)) || selectedUserForAdd;
                const calculatedNet = targetUser?.netPayable || 0;
                const enteredAmount = parseFloat(txnAmount) || 0;
                const diff = enteredAmount - calculatedNet;

                if (enteredAmount > 0 && Math.abs(diff) >= 0.01) {
                  return (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-500 space-y-1">
                      <p className="font-bold">
                        💡 Ajustement / Arrondi automatique: {diff > 0 ? `+${diff.toFixed(2)} ${currency}` : `${diff.toFixed(2)} ${currency}`}
                      </p>
                      <p className="text-[11px] opacity-80">
                        Net Calculé: {calculatedNet.toFixed(2)} {currency} • Montant Saisi: {enteredAmount.toFixed(2)} {currency}
                      </p>
                      <p className="text-[11px] font-semibold text-foreground/70 pt-1">
                        Le virement ({enteredAmount.toFixed(2)} {currency}) diffère du solde calculé ({calculatedNet.toFixed(2)} {currency}). Une prime/ajustement sera automatiquement créée pour solder la période à 0,00 {currency} !
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Date du Versement
                  </label>
                  <input
                    type="date"
                    required
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Mode de Paiement
                  </label>
                  <select
                    value={txnMethod}
                    onChange={(e: any) => setTxnMethod(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="CASH">Espèces</option>
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CHECK">Chèque</option>
                  </select>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                  Référence / N° Chèque (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: CHQ-984210"
                  value={txnRef}
                  onChange={(e) => setTxnRef(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                  Motif / Remarque (Optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="ex: Avance exceptionnelle pour urgence"
                  value={txnNotes}
                  onChange={(e) => setTxnNotes(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {modalError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium text-center">
                  {modalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground/70 hover:bg-surface text-sm font-medium transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.3)]"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Enregistrer le Versement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: History & Printable Receipt */}
      {isHistoryModalOpen && historyUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-2xl p-6 space-y-6 border-border relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-foreground/50 hover:text-foreground rounded-lg hover:bg-surface transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-border pb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black text-base shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                {historyUser.firstName[0]}{historyUser.lastName[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {historyUser.lastName.replace(/_/g, ' ').toUpperCase()} {historyUser.firstName.replace(/_/g, ' ')}
                </h2>
                <p className="text-xs text-foreground/60">
                  ID ZKTeco: {historyUser.zktecoUserId} • Shift: {historyUser.shiftName} • Période: {periodLabel || selectedDate}
                </p>
              </div>
            </div>

            {/* If Receipt Mode is active, render printable voucher */}
            {receiptTxn ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center bg-surface/80 p-3 rounded-xl border border-border">
                  <span className="text-xs font-semibold text-foreground/70">Aperçu du Reçu de Paiement</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimer Reçu
                    </button>
                    <button
                      onClick={() => setReceiptTxn(null)}
                      className="px-3 py-1.5 border border-border text-foreground/70 text-xs font-medium rounded-lg hover:bg-surface transition-colors cursor-pointer"
                    >
                      Fermer Aperçu
                    </button>
                  </div>
                </div>

                {/* Printable Receipt Paper Sheet */}
                <div className="p-8 bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-xl space-y-6 print:p-0 print:shadow-none">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-blue-900">{companyName}</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Suivi des Présences & Paie</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200 uppercase tracking-wider">
                        REÇU N° {receiptTxn.id.substring(0, 8).toUpperCase()}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">Date: {new Date(receiptTxn.date).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block font-medium">BÉNÉFICIAIRE / EMPLOYÉ</span>
                      <span className="font-bold text-slate-900 text-sm block mt-0.5">
                        {historyUser.lastName.replace(/_/g, ' ').toUpperCase()} {historyUser.firstName.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-600 block mt-0.5">ID: {historyUser.zktecoUserId} • CIN: {historyUser.cin || "N/A"}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 block font-medium">TYPE DE VERSEMENT</span>
                      <span className="font-bold text-blue-700 text-sm block mt-0.5">{receiptTxn.type}</span>
                      <span className="text-slate-600 block mt-0.5">Mode: {receiptTxn.method}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center">
                    <span className="font-bold text-emerald-900 text-sm">MONTANT REÇU</span>
                    <p className="text-3xl font-black text-slate-900">
                      {receiptTxn.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </p>
                  </div>

                  {receiptTxn.notes && (
                    <div className="text-xs text-slate-600 border-l-2 border-slate-300 pl-3 py-1 italic">
                      Remarque / Motif: "{receiptTxn.notes}"
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
                    <div className="space-y-12">
                      <p className="font-bold text-slate-700">Signature de l'Artisan / Bénéficiaire</p>
                      <div className="border-b border-dashed border-slate-300 w-32 mx-auto" />
                    </div>
                    <div className="space-y-12">
                      <p className="font-bold text-slate-700">Signature & Cachet Direction</p>
                      <div className="border-b border-dashed border-slate-300 w-32 mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Transactions History Table */
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryTab("PAYMENTS")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        historyTab === "PAYMENTS"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-surface hover:bg-surface-hover text-foreground/70 border border-border"
                      }`}
                    >
                      💸 Versements & Virements ({historyList.filter(t => t.type === "ADVANCE" || t.type === "ACOMPTE" || t.type === "FINAL_PAY").length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryTab("ADJUSTMENTS")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        historyTab === "ADJUSTMENTS"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-surface hover:bg-surface-hover text-foreground/70 border border-border"
                      }`}
                    >
                      ✏️ Primes & Ajustements ({historyList.filter(t => t.type === "BONUS" || t.type === "DEDUCTION").length})
                    </button>
                  </div>
                  <button
                    onClick={() => handleOpenAddModal(historyUser)}
                    className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Enregistrer un Versement
                  </button>
                </div>

                {isHistoryLoading ? (
                  <div className="p-8 text-center text-foreground/50">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Chargement de l'historique...
                  </div>
                ) : (() => {
                  const filteredList = historyList.filter(t => 
                    historyTab === "PAYMENTS" 
                      ? (t.type === "ADVANCE" || t.type === "ACOMPTE" || t.type === "FINAL_PAY")
                      : (t.type === "BONUS" || t.type === "DEDUCTION")
                  );

                  if (filteredList.length === 0) {
                    return (
                      <div className="p-8 text-center text-foreground/50 glass-panel rounded-2xl">
                        {historyTab === "PAYMENTS" 
                          ? "Aucun versement ou virement bancaire décaissé pour cet employé."
                          : "Aucune prime ou ajustement manuel enregistré pour cet employé."
                        }
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                      {filteredList.map((txn) => {
                        const pDate = new Date(txn.periodDate || txn.date);
                        const periodStr = pDate.toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' });
                        const paymentDateStr = new Date(txn.date).toLocaleDateString("fr-FR");

                        return (
                          <div key={txn.id} className="p-4 bg-background/50 hover:bg-surface/50 transition-colors flex items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {getTypeBadge(txn.type)}
                                {getMethodBadge(txn.method)}
                                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-wider">
                                  Période: {periodStr}
                                </span>
                                <span className="text-xs text-foreground/50">Payé le {paymentDateStr}</span>
                              </div>
                              {txn.notes && (
                                <p className="text-xs text-foreground/70 italic">{txn.notes}</p>
                              )}
                              {txn.reference && (
                                <p className="text-[11px] text-foreground/50 font-mono">Réf: {txn.reference}</p>
                              )}
                            </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold text-foreground text-base">
                              {txn.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                            </span>
                            <button
                              onClick={() => setReceiptTxn(txn)}
                              title="Aperçu & Imprimer Reçu"
                              className="p-1.5 rounded-lg bg-surface hover:bg-surface-hover text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTxn(txn.id)}
                              title="Supprimer cette opération"
                              className="p-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* Modal 3: Printable Fiche de Paie (Bulletin de Solde) */}
      {isPayslipModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 print-modal-container">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 print-modal-card">
            {/* Modal Control Header (hidden on print) */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                Fiche de Paie & Bulletin de Solde ({payslipUsers.length})
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSmartPrint("PAYSLIP")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimer / Exporter PDF
                </button>
                <button
                  onClick={() => setIsPayslipModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Styling for Clean A4 Output */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                body {
                  background: white !important;
                  color: #0f172a !important;
                }
                .print\\:hidden, nav, header, sidebar, .fixed.bottom-6 {
                  display: none !important;
                }
                .print-modal-container {
                  position: static !important;
                  background: transparent !important;
                  backdrop-filter: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  overflow: visible !important;
                  max-height: none !important;
                }
                .print-modal-card {
                  box-shadow: none !important;
                  border: none !important;
                  background: transparent !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  max-width: 100% !important;
                  max-height: none !important;
                  overflow: visible !important;
                  border-radius: 0 !important;
                }
                #printable-payslip-list {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .payslip-print-card {
                  page-break-before: auto !important;
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  margin: 0 0 0 0 !important;
                  padding: 24px !important;
                  border: 1.5px solid #0f172a !important;
                  border-radius: 12px !important;
                  box-shadow: none !important;
                  background: white !important;
                  box-sizing: border-box !important;
                }
                .payslip-print-card:last-child {
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
              }
            ` }} />

            {/* Printable Payslips Container */}
            <div id="printable-payslip-list" className="space-y-8 print:space-y-0">
              {payslipUsers.map((u) => (
                <div key={u.userId} className="payslip-print-card space-y-6 p-6 border border-slate-300 rounded-2xl bg-white text-slate-900 shadow-sm">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">{companyName.toUpperCase()} - SUIVI DES PRÉSENCES & PAIE</h1>
                      <p className="text-xs text-slate-600 font-bold mt-0.5">BULLETIN DE PAIE & FICHE INDIVIDUELLE</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-slate-900 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                        FICHE DE PAIE
                      </span>
                      <p className="text-xs font-extrabold text-blue-700 mt-1">Période: {periodLabel}</p>
                    </div>
                  </div>

                  {/* Employee Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-100 rounded-xl border border-slate-300 text-xs">
                    <div>
                      <span className="text-slate-500 block font-semibold">NOM & PRÉNOM</span>
                      <span className="font-black text-slate-900 text-sm block mt-0.5">{u.lastName.toUpperCase()} {u.firstName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-semibold">ID ZKTECO / CIN</span>
                      <span className="font-bold text-slate-900 block mt-0.5">ID: {u.zktecoUserId} {u.cin ? `• CIN: ${u.cin}` : ''}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-semibold">SHIFT & TAUX</span>
                      <span className="font-bold text-slate-900 block mt-0.5">{u.shiftName} ({u.hourlyRate} {currency}/h)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-semibold">FRÉQUENCE</span>
                      <span className="font-black text-purple-700 block mt-0.5">{u.paymentFrequency === "WEEKLY" ? "HEBDOMADAIRE" : "MENSUEL"}</span>
                    </div>
                  </div>

                  {/* Wage Breakdown Table */}
                  <table className="w-full text-xs text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                        <th className="p-3 border-r border-slate-300">Rubrique de Gain / Heures</th>
                        <th className="p-3 border-r border-slate-300 text-right">Base (Heures)</th>
                        <th className="p-3 border-r border-slate-300 text-right">Taux ({currency}/h)</th>
                        <th className="p-3 text-right">Montant Gagné ({currency})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      <tr>
                        <td className="p-3 font-bold text-slate-900 border-r border-slate-300">Heures Normales Travaillées</td>
                        <td className="p-3 text-center border-r border-slate-300 font-semibold">{u.regularHours || 0} h</td>
                        <td className="p-3 text-right border-r border-slate-300 text-slate-700">{u.hourlyRate} {currency}</td>
                        <td className="p-3 text-right font-black text-slate-900">
                          {((u.regularHours || 0) * (u.hourlyRate || 0)).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </td>
                      </tr>
                      {(u.ot150 || 0) > 0 && (
                        <tr>
                          <td className="p-3 font-bold text-blue-700 border-r border-slate-300">Heures Supplémentaires 150%</td>
                          <td className="p-3 text-center border-r border-slate-300 font-semibold">{u.ot150} h</td>
                          <td className="p-3 text-right border-r border-slate-300 text-slate-700">{(u.hourlyRate * 1.5).toFixed(2)} {currency}</td>
                          <td className="p-3 text-right font-black text-blue-700">
                            {(u.ot150 * u.hourlyRate * 1.5).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </td>
                        </tr>
                      )}
                      {(u.ot200 || 0) > 0 && (
                        <tr>
                          <td className="p-3 font-bold text-purple-700 border-r border-slate-300">Heures Supplémentaires 200%</td>
                          <td className="p-3 text-center border-r border-slate-300 font-semibold">{u.ot200} h</td>
                          <td className="p-3 text-right border-r border-slate-300 text-slate-700">{(u.hourlyRate * 2.0).toFixed(2)} {currency}</td>
                          <td className="p-3 text-right font-black text-purple-700">
                            {(u.ot200 * u.hourlyRate * 2.0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                        <td colSpan={3} className="p-3 text-slate-900 border-r border-slate-300">TOTAL SALAIRE BRUT GAGNÉ</td>
                        <td className="p-3 text-right text-slate-900 text-sm">
                          {u.earnedSalary.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Deductions & Net Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-100 border border-slate-300 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between text-slate-700">
                        <span>Primes & Gratifications:</span>
                        <span className="font-black text-emerald-700">+{u.bonuses.toFixed(2)} {currency}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Retenues & Pénalités:</span>
                        <span className="font-black text-rose-700">-{u.deductions.toFixed(2)} {currency}</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Avances sur Salaire Perçues:</span>
                        <span className="font-black text-amber-700">-{u.advances.toFixed(2)} {currency}</span>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border-2 border-blue-600 rounded-xl flex flex-col justify-center items-end text-right">
                      <span className="text-xs font-black text-blue-950 uppercase tracking-wider">NET À PAYER</span>
                      <span className="text-3xl font-black text-blue-700 mt-1">
                        {u.netPayable.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Printable Global Payout Order Document */}
      {isGlobalPayoutModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200 print-modal-container">
          <div className="bg-white text-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 print-modal-card">
            {/* Modal Control Header (hidden on print) */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <Printer className="w-5 h-5 text-emerald-600" />
                Ordre de Paiement Global & Liste de Virement ({payslipUsers.length})
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSmartPrint("GLOBAL_ORDER")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Imprimer / Exporter PDF
                </button>
                <button
                  onClick={() => setIsGlobalPayoutModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Global Payout Content */}
            <div className="space-y-6 p-4 bg-white">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{companyName.toUpperCase()} - SUIVI DES PRÉSENCES & PAIE</h1>
                  <p className="text-xs text-slate-600 font-semibold">ORDRE DE PAIEMENT & BORDEREAU DES SALAIRES</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-900">Date d'impression: {new Date().toLocaleDateString("fr-FR")}</p>
                  <p className="text-xs font-semibold text-blue-700 mt-1">Période: {periodLabel}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-xs text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300 uppercase tracking-wider">
                    <th className="p-3 border-r border-slate-300 text-center w-10">#</th>
                    <th className="p-3 border-r border-slate-300">ID ZK</th>
                    <th className="p-3 border-r border-slate-300">Nom & Prénom</th>
                    <th className="p-3 border-r border-slate-300 text-center">Mode</th>
                    <th className="p-3 border-r border-slate-300 text-right">Salaire Brut</th>
                    <th className="p-3 border-r border-slate-300 text-right text-rose-700">Avances / Ret.</th>
                    <th className="p-3 text-right text-emerald-800 font-black">NET À REGLER ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {payslipUsers.map((u, i) => (
                    <tr key={u.userId} className="hover:bg-slate-50">
                      <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-500">{i + 1}</td>
                      <td className="p-3 border-r border-slate-300 font-bold text-slate-900">{u.zktecoUserId}</td>
                      <td className="p-3 border-r border-slate-300">
                        <span className="font-bold text-slate-900 block">{u.lastName.toUpperCase()} {u.firstName}</span>
                        {u.rib && <span className="text-[10px] text-slate-500 font-mono">RIB: {u.rib}</span>}
                      </td>
                      <td className="p-3 text-center border-r border-slate-300">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {u.paymentFrequency === "WEEKLY" ? "HEBDO" : "MOIS"}
                        </span>
                      </td>
                      <td className="p-3 text-right border-r border-slate-300 font-medium">
                        {u.earnedSalary.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </td>
                      <td className="p-3 text-right border-r border-slate-300 font-medium text-rose-700">
                        -{(u.advances + u.deductions).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700 text-sm">
                        {u.netPayable.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-sm">
                    <td colSpan={6} className="p-4 border-r border-slate-300 text-right text-slate-900">
                      TOTAL GLOBAL À PAYER :
                    </td>
                    <td className="p-4 text-right text-emerald-800 text-base">
                      {payslipUsers.reduce((sum, u) => sum + Math.max(0, u.netPayable), 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
                <div className="space-y-14">
                  <p className="font-bold text-slate-800">Établi par (Service Comptabilité & Paie)</p>
                  <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
                <div className="space-y-14">
                  <p className="font-bold text-slate-800">Approuvé par (Direction Générale)</p>
                  <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Single User Net Adjustment Modal */}
      {isAdjustModalOpen && adjustUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                🎯 Ajuster le Solde à Verser
              </h2>
              <button onClick={() => setIsAdjustModalOpen(false)} className="p-1 text-foreground/50 hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div className="bg-surface/60 p-3.5 rounded-xl border border-border space-y-1">
                <p className="text-xs font-semibold text-foreground/60">EMPLOYÉ BÉNÉFICIAIRE</p>
                <p className="text-sm font-bold text-foreground">{adjustUser.lastName.toUpperCase()} {adjustUser.firstName}</p>
                <p className="text-xs text-foreground/50">Solde Calculé Actuel (ZKTeco): <span className="font-bold text-foreground">{adjustUser.netPayable.toFixed(2)} {currency}</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-1">Montant Net Souhaité à Verser ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={targetNetInput}
                  onChange={(e) => setTargetNetInput(e.target.value)}
                  placeholder="Ex: 650.00"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-base font-bold text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Quick Rounding Buttons */}
              <div className="space-y-1.5">
                <span className="text-xs text-foreground/50 font-medium">Arrondis Rapides :</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetNetInput((Math.ceil(adjustUser.netPayable / 10) * 10).toString())}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-primary cursor-pointer"
                  >
                    Arrondir à {Math.ceil(adjustUser.netPayable / 10) * 10} {currency}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetNetInput((Math.ceil(adjustUser.netPayable / 50) * 50).toString())}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-purple-500 cursor-pointer"
                  >
                    Arrondir à {Math.ceil(adjustUser.netPayable / 50) * 50} {currency}
                  </button>
                </div>
              </div>

              {/* Live calculation helper */}
              {(() => {
                const targetNum = parseFloat(targetNetInput) || 0;
                const diff = targetNum - adjustUser.netPayable;
                if (Math.abs(diff) >= 0.01) {
                  return (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-500 space-y-1">
                      <p className="font-bold">💡 Ajustement / Arrondi détecté: {diff > 0 ? `+${diff.toFixed(2)} ${currency}` : `${diff.toFixed(2)} ${currency}`}</p>
                      <p className="text-[11px] opacity-80">Cette différence sera enregistrée comme prime/arrondi et figurera clairement sur la fiche de paie.</p>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-1">Motif / Remarque</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {modalError && <p className="text-xs text-danger font-semibold">{modalError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 bg-surface text-foreground/70 text-xs font-semibold rounded-xl cursor-pointer">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer">
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enregistrer l'Ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Batch Payout Confirmation Modal */}
      {isBatchPayModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div className="flex items-center gap-2 text-foreground font-bold text-lg">
                <Banknote className="w-5 h-5 text-emerald-500" />
                Validation du Règlement Solde Final ({selectedUserIds.length} employé(s))
              </div>
              <button onClick={() => setIsBatchPayModalOpen(false)} className="p-1 text-foreground/50 hover:text-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBatchPay} className="space-y-4">
              <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">EMPLOYÉS CONCERNÉS</span>
                  <span className="text-xs font-bold text-emerald-500">{selectedUserIds.length} sélectionné(s)</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20">
                  <span className="text-sm font-bold text-foreground">MONTANT TOTAL DU VIREMENT</span>
                  <span className="text-xl font-black text-emerald-500">
                    {data
                      .filter(u => selectedUserIds.includes(u.userId))
                      .reduce((sum, u) => sum + Math.max(0, u.netPayable), 0)
                      .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Mode de Paiement
                  </label>
                  <select
                    value={batchPayMethod}
                    onChange={(e: any) => setBatchPayMethod(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Virement Bancaire</option>
                    <option value="CASH">Espèces</option>
                    <option value="CHECK">Chèque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                    Date du Virement
                  </label>
                  <input
                    type="date"
                    required
                    value={batchPayDate}
                    onChange={(e) => setBatchPayDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                  Référence / N° Virement (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: VIR-2026-07-27 ou N° Chèque"
                  value={batchPayRef}
                  onChange={(e) => setBatchPayRef(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-1.5">
                  Motif / Remarque
                </label>
                <input
                  type="text"
                  value={batchPayNotes}
                  onChange={(e) => setBatchPayNotes(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBatchPayModalOpen(false)}
                  className="px-4 py-2 bg-surface text-foreground/70 text-xs font-semibold rounded-xl cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle2 className="w-4 h-4" /> Valider & Marquer comme Payé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
