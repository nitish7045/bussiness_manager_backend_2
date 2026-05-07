// backend/routes/salaryRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const Salary = require("../models/Salary");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Advance = require("../models/Advance");
const AdvanceTransaction = require("../models/AdvanceTransaction");
const User = require("../models/User");

// Helper function to get Sundays in a month
function getSundaysInMonth(year, month) {
  const date = new Date(year, month - 1, 1);
  let sundays = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 0) sundays++;
    date.setDate(date.getDate() + 1);
  }
  return sundays;
}

// Helper function to get day of week
function getDayOfWeek(dateStr) {
  const date = new Date(dateStr);
  return date.getDay();
}

// Calculate salary for a worker
router.post("/calculate/:workerId", auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    const { month, year } = req.body;

    const worker = await Employee.findOne({
      _id: workerId,
      companyId: req.user.companyId
    });

    if (!worker) {
      return res.status(404).json({ msg: "Worker not found" });
    }

    const dailySalary = worker.wages.monthly / worker.wages.calculationDays;
    const hourlySalary = dailySalary / 8;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    
    const attendanceRecords = await Attendance.find({
      workerId,
      date: { $gte: startDate, $lte: endDate },
      companyId: req.user.companyId
    });

    let weekdayPresent = 0;
    let weekdayHalf = 0;
    let sundayPresent = 0;
    let sundayHalf = 0;
    let sundayHoliday = 0;
    let otherHolidays = 0;
    let overtimeHours = 0;

    attendanceRecords.forEach(record => {
      const dayOfWeek = getDayOfWeek(record.date);
      const isSunday = dayOfWeek === 0;
      
      if (isSunday) {
        if (record.status === "present") sundayPresent++;
        else if (record.status === "halfday") sundayHalf++;
        else if (record.status === "holiday") sundayHoliday++;
      } else {
        if (record.status === "present") weekdayPresent++;
        else if (record.status === "halfday") weekdayHalf++;
        else if (record.status === "holiday") otherHolidays++;
      }
      
      overtimeHours += record.overtimeHours || 0;
    });

    const totalSundays = getSundaysInMonth(year, month);
    const sundayAbsent = totalSundays - (sundayPresent + sundayHalf + sundayHoliday);

    const weekdayPay = weekdayPresent * dailySalary;
    const weekdayHalfPay = weekdayHalf * (dailySalary * 0.5);
    const sundayPresentPay = sundayPresent * (dailySalary * 2);
    const sundayHalfPay = sundayHalf * (dailySalary * 1.5);
    const sundayHolidayPay = sundayHoliday * dailySalary;
    const otherHolidayPay = otherHolidays * dailySalary;
    const overtimePay = overtimeHours * hourlySalary;
    
    const totalEarnings = weekdayPay + weekdayHalfPay + sundayPresentPay + sundayHalfPay + 
                          sundayHolidayPay + otherHolidayPay + overtimePay;

    const monthlyAdvance = await Advance.findOne({
      workerId,
      companyId: req.user.companyId,
      type: "monthly"
    });
    
    const loan = await Advance.findOne({
      workerId,
      companyId: req.user.companyId,
      type: "loan"
    });

    const monthlyAdvanceDue = monthlyAdvance?.remainingAmount || 0;
    const loanDue = loan?.remainingAmount || 0;

    const defaultMonthlyDeduction = monthlyAdvanceDue;
    const defaultLoanDeduction = 0;

    res.json({
      worker: {
        _id: worker._id,
        name: worker.name,
        designation: worker.designation,
        monthlySalary: worker.wages.monthly,
        calculationDays: worker.wages.calculationDays
      },
      rates: {
        dailySalary,
        hourlySalary
      },
      attendance: {
        weekdayPresent,
        weekdayHalf,
        sundayPresent,
        sundayHalf,
        sundayHoliday,
        sundayAbsent,
        otherHolidays,
        totalSundays,
        overtimeHours
      },
      earnings: {
        weekdayPay,
        weekdayHalfPay,
        sundayPresentPay,
        sundayHalfPay,
        sundayHolidayPay,
        otherHolidayPay,
        overtimePay,
        totalEarnings
      },
      deductions: {
        monthlyAdvanceDue,
        loanDue,
        defaultMonthlyDeduction,
        defaultLoanDeduction
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error calculating salary", error: err.message });
  }
});

// Save calculated salary (with proper balance restoration for edits)
router.post("/save", auth, async (req, res) => {
  try {
    const { salaries } = req.body;
    const savedSalaries = [];
    
    for (const salaryData of salaries) {
      const {
        workerId,
        month,
        year,
        attendance,
        rates,
        earnings,
        deductions: ownerDeductions,
        notes
      } = salaryData;

      // Check if salary already exists
      let existingSalary = await Salary.findOne({
        workerId,
        companyId: req.user.companyId,
        month: parseInt(month),
        year: parseInt(year)
      });

      // Get current advances
      let monthlyAdvance = await Advance.findOne({
        workerId,
        companyId: req.user.companyId,
        type: "monthly"
      });
      
      let loan = await Advance.findOne({
        workerId,
        companyId: req.user.companyId,
        type: "loan"
      });

      // IMPORTANT: If we're editing an existing salary, restore the previous balances
      if (existingSalary) {
        // Restore previous deductions back to advances
        if (monthlyAdvance && existingSalary.deductions.monthlyAdvanceDeducted > 0) {
          monthlyAdvance.remainingAmount += existingSalary.deductions.monthlyAdvanceDeducted;
          await monthlyAdvance.save();
        }
        
        if (loan && existingSalary.deductions.loanDeducted > 0) {
          loan.remainingAmount += existingSalary.deductions.loanDeducted;
          await loan.save();
        }
        
        // Also delete old transaction records for this salary
        await AdvanceTransaction.deleteMany({
          workerId,
          companyId: req.user.companyId,
          remark: { $regex: `Salary deduction for ${month}/${year}` }
        });
      }

      // Now get the updated due amounts after restoration
      const monthlyAdvanceDue = monthlyAdvance?.remainingAmount || 0;
      const loanDue = loan?.remainingAmount || 0;

      // Apply new deductions (what owner entered)
      const monthlyAdvanceDeducted = Math.min(ownerDeductions.monthlyAdvance, monthlyAdvanceDue);
      const loanDeducted = Math.min(ownerDeductions.loan, loanDue);
      
      let totalDeductions = monthlyAdvanceDeducted + loanDeducted;
      let netSalary = earnings.totalEarnings - totalDeductions;
      
      let monthlyAdvanceRemaining = monthlyAdvanceDue - monthlyAdvanceDeducted;
      let loanRemaining = loanDue - loanDeducted;
      
      if (netSalary < 0) {
        const excess = Math.abs(netSalary);
        if (monthlyAdvanceDeducted > 0 && loanDeducted > 0) {
          const monthlyRatio = monthlyAdvanceDeducted / totalDeductions;
          const loanRatio = loanDeducted / totalDeductions;
          monthlyAdvanceRemaining += excess * monthlyRatio;
          loanRemaining += excess * loanRatio;
          netSalary = 0;
          totalDeductions = (monthlyAdvanceDeducted - (excess * monthlyRatio)) + (loanDeducted - (excess * loanRatio));
        } else if (monthlyAdvanceDeducted > 0) {
          monthlyAdvanceRemaining += excess;
          netSalary = 0;
        } else if (loanDeducted > 0) {
          loanRemaining += excess;
          netSalary = 0;
        }
      }

      const salaryDataToSave = {
        workerId,
        companyId: req.user.companyId,
        month: parseInt(month),
        year: parseInt(year),
        attendance: {
          weekdayPresent: attendance.weekdayPresent,
          weekdayHalf: attendance.weekdayHalf,
          sundayPresent: attendance.sundayPresent,
          sundayHalf: attendance.sundayHalf,
          sundayHoliday: attendance.sundayHoliday,
          otherHolidays: attendance.otherHolidays,
          overtimeHours: attendance.overtimeHours,
          totalSundays: attendance.totalSundays
        },
        dailySalary: rates.dailySalary,
        hourlySalary: rates.hourlySalary,
        earnings: {
          weekdayPay: earnings.weekdayPay,
          weekdayHalfPay: earnings.weekdayHalfPay,
          sundayPresentPay: earnings.sundayPresentPay,
          sundayHalfPay: earnings.sundayHalfPay,
          sundayHolidayPay: earnings.sundayHolidayPay,
          otherHolidayPay: earnings.otherHolidayPay,
          overtimePay: earnings.overtimePay,
          totalEarnings: earnings.totalEarnings
        },
        deductions: {
          monthlyAdvanceDeducted,
          loanDeducted,
          totalDeductions
        },
        carryForwardFromPrev: {
          monthlyAdvance: monthlyAdvanceDue - (ownerDeductions.monthlyAdvance || 0),
          loan: loanDue - (ownerDeductions.loan || 0)
        },
        newAdvances: {
          monthlyAdvance: 0,
          loan: 0
        },
        carryForwardToNext: {
          monthlyAdvance: monthlyAdvanceRemaining,
          loan: loanRemaining
        },
        netSalary: netSalary >= 0 ? netSalary : 0,
        ownerEdits: {
          monthlyAdvanceDeduction: monthlyAdvanceDeducted,
          loanDeduction: loanDeducted,
          notes: notes || ""
        },
        status: "processed",
        processedAt: new Date()
      };

      let salary;
      
      // If salary exists, update it; otherwise create new
      if (existingSalary) {
        salary = await Salary.findOneAndUpdate(
          { 
            workerId, 
            companyId: req.user.companyId, 
            month: parseInt(month), 
            year: parseInt(year) 
          },
          salaryDataToSave,
          { new: true }
        );
      } else {
        salary = new Salary(salaryDataToSave);
        await salary.save();
      }
      
      savedSalaries.push(salary);

      // Update advance records with new remaining amounts
      if (monthlyAdvance) {
        monthlyAdvance.remainingAmount = monthlyAdvanceRemaining;
        await monthlyAdvance.save();
        
        if (monthlyAdvanceDeducted > 0) {
          await AdvanceTransaction.create({
            workerId,
            advanceId: monthlyAdvance._id,
            companyId: req.user.companyId,
            type: "debit",
            amount: monthlyAdvanceDeducted,
            remark: `Salary deduction for ${month}/${year}`
          });
        }
      }
      
      if (loan) {
        loan.remainingAmount = loanRemaining;
        await loan.save();
        
        if (loanDeducted > 0) {
          await AdvanceTransaction.create({
            workerId,
            advanceId: loan._id,
            companyId: req.user.companyId,
            type: "debit",
            amount: loanDeducted,
            remark: `Salary deduction for ${month}/${year}`
          });
        }
      }
    }

    res.json({ 
      msg: `${savedSalaries.length} salaries saved successfully`,
      salaries: savedSalaries 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error saving salaries", error: err.message });
  }
});

// Get all salaries for a month
router.get("/monthly", auth, async (req, res) => {
  try {
    const { month, year, status } = req.query;
    
    let filter = {
      companyId: req.user.companyId,
      month: parseInt(month),
      year: parseInt(year)
    };
    
    if (status) filter.status = status;
    
    const salaries = await Salary.find(filter)
      .populate("workerId", "name designation wages phone")
      .sort({ "workerId.name": 1 });
    
    res.json(salaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching salaries" });
  }
});

// Get salary history for a worker
router.get("/worker/:workerId/history", auth, async (req, res) => {
  try {
    const salaries = await Salary.find({
      workerId: req.params.workerId,
      companyId: req.user.companyId
    })
    .sort({ year: -1, month: -1 })
    .limit(12);
    
    res.json(salaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching salary history" });
  }
});

// Mark salary as paid
router.patch("/:id/paid", auth, async (req, res) => {
  try {
    const { paymentMethod, paymentNotes } = req.body;
    
    const salary = await Salary.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!salary) {
      return res.status(404).json({ msg: "Salary record not found" });
    }
    
    const now = new Date();
    
    salary.status = "paid";
    salary.paidAt = now;
    salary.paymentDetails = {
      status: "paid",
      paidAt: now,
      paymentMethod: paymentMethod || "cash",
      paymentNotes: paymentNotes || "Payment received",
      paidBy: req.user.name || req.user.email || "System"
    };
    
    await salary.save();
    
    res.json({ 
      msg: "Salary marked as paid", 
      salary,
      paymentDetails: salary.paymentDetails
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating salary status" });
  }
});

// Bulk download all salaries for a month
router.get("/bulk-download", auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const salaries = await Salary.find({
      companyId: req.user.companyId,
      month: parseInt(month),
      year: parseInt(year),
      status: "paid"
    }).populate("workerId", "name designation phone aadhaar");
    
    const user = await User.findById(req.user.id).select("companyDetails name email");
    
    res.json({
      salaries,
      companyDetails: user.companyDetails,
      companyName: user.companyDetails?.name || "Business Manager",
      generatedBy: user.name,
      generatedDate: new Date()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching salaries for bulk download" });
  }
});

// Add this to salaryRoutes.js
// Update salary deductions
router.put("/:id/deductions", auth, async (req, res) => {
  try {
    const { monthlyAdvance, loan, notes } = req.body;
    
    const salary = await Salary.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });
    
    if (!salary) {
      return res.status(404).json({ msg: "Salary record not found" });
    }
    
    const totalEarnings = salary.earnings.totalEarnings;
    let monthlyAdvanceDeduction = monthlyAdvance !== undefined ? monthlyAdvance : salary.deductions.monthlyAdvanceDeducted;
    let loanDeduction = loan !== undefined ? loan : salary.deductions.loanDeducted;
    
    let totalDeductions = monthlyAdvanceDeduction + loanDeduction;
    let netSalary = totalEarnings - totalDeductions;
    let monthlyAdvanceRemaining = 0;
    let loanRemaining = 0;
    
    if (netSalary < 0) {
      const excess = Math.abs(netSalary);
      if (monthlyAdvanceDeduction > 0 && loanDeduction > 0) {
        const ratio = monthlyAdvanceDeduction / totalDeductions;
        monthlyAdvanceRemaining = excess * ratio;
        loanRemaining = excess - monthlyAdvanceRemaining;
        monthlyAdvanceDeduction -= monthlyAdvanceRemaining;
        loanDeduction -= loanRemaining;
      } else if (monthlyAdvanceDeduction > 0) {
        monthlyAdvanceRemaining = excess;
        monthlyAdvanceDeduction -= excess;
      } else if (loanDeduction > 0) {
        loanRemaining = excess;
        loanDeduction -= excess;
      }
      netSalary = 0;
    }
    
    // Update salary
    salary.deductions.monthlyAdvanceDeducted = monthlyAdvanceDeduction;
    salary.deductions.loanDeducted = loanDeduction;
    salary.deductions.totalDeductions = monthlyAdvanceDeduction + loanDeduction;
    salary.netSalary = netSalary;
    salary.carryForwardToNext.monthlyAdvance = monthlyAdvanceRemaining;
    salary.carryForwardToNext.loan = loanRemaining;
    salary.ownerEdits.monthlyAdvanceDeduction = monthlyAdvanceDeduction;
    salary.ownerEdits.loanDeduction = loanDeduction;
    if (notes !== undefined) salary.ownerEdits.notes = notes;
    
    await salary.save();
    
    res.json({ 
      msg: "Salary updated successfully", 
      salary,
      carryForward: {
        monthlyAdvance: monthlyAdvanceRemaining,
        loan: loanRemaining
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating salary" });
  }
});

// DELETE endpoint for salary record with two options
router.delete("/:id", auth, async (req, res) => {
  try {
    const salaryId = req.params.id;
    const { restoreAmounts } = req.query; // Query param: ?restoreAmounts=true
    
    // Find the salary record
    const salary = await Salary.findOne({
      _id: salaryId,
      companyId: req.user.companyId
    });
    
    if (!salary) {
      return res.status(404).json({ 
        success: false, 
        msg: "Salary record not found" 
      });
    }
    
    const monthlyAdvanceDeducted = salary.deductions?.monthlyAdvanceDeducted || 0;
    const loanDeducted = salary.deductions?.loanDeducted || 0;
    
    // If restoreAmounts is true, restore the deducted amounts back to advances
    if (restoreAmounts === 'true' && (monthlyAdvanceDeducted > 0 || loanDeducted > 0)) {
      
      // Restore Monthly Advance
      if (monthlyAdvanceDeducted > 0) {
        let monthlyAdvance = await Advance.findOne({
          workerId: salary.workerId,
          companyId: req.user.companyId,
          type: "monthly"
        });
        
        if (monthlyAdvance) {
          monthlyAdvance.remainingAmount += monthlyAdvanceDeducted;
          await monthlyAdvance.save();
          
          // Create a reversal transaction record
          await AdvanceTransaction.create({
            workerId: salary.workerId,
            advanceId: monthlyAdvance._id,
            companyId: req.user.companyId,
            type: "credit",
            amount: monthlyAdvanceDeducted,
            remark: `Reversal: Salary deletion for ${salary.month}/${salary.year}`
          });
        }
      }
      
      // Restore Loan
      if (loanDeducted > 0) {
        let loan = await Advance.findOne({
          workerId: salary.workerId,
          companyId: req.user.companyId,
          type: "loan"
        });
        
        if (loan) {
          loan.remainingAmount += loanDeducted;
          await loan.save();
          
          // Create a reversal transaction record
          await AdvanceTransaction.create({
            workerId: salary.workerId,
            advanceId: loan._id,
            companyId: req.user.companyId,
            type: "credit",
            amount: loanDeducted,
            remark: `Reversal: Salary deletion for ${salary.month}/${salary.year}`
          });
        }
      }
      
      // Also delete the original deduction transactions
      await AdvanceTransaction.deleteMany({
        workerId: salary.workerId,
        companyId: req.user.companyId,
        remark: { $regex: `Salary deduction for ${salary.month}/${salary.year}` }
      });
    }
    
    // Delete the salary record
    await Salary.findByIdAndDelete(salaryId);
    
    res.json({ 
      success: true, 
      msg: restoreAmounts === 'true' 
        ? "Salary deleted and deducted amounts restored to advances" 
        : "Salary deleted successfully",
      restored: {
        monthlyAdvance: restoreAmounts === 'true' ? monthlyAdvanceDeducted : 0,
        loan: restoreAmounts === 'true' ? loanDeducted : 0
      }
    });
  } catch (error) {
    console.error("Error deleting salary:", error);
    res.status(500).json({ 
      success: false, 
      msg: "Server error while deleting salary record" 
    });
  }
});
module.exports = router;