// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, push } from "firebase/database";
import { ReallocationData, DispatchData, ScheduleData, ProcessedReallocationEntry, ProcessedDispatchEntry } from "@/types";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcczqGj5X1_w9aCX1lOK4-kgz49Oi03Bg",
  authDomain: "scheduling-dd672.firebaseapp.com",
  databaseURL: "https://scheduling-dd672-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scheduling-dd672",
  storageBucket: "scheduling-dd672.firebasestorage.app",
  messagingSenderId: "432092773012",
  appId: "1:432092773012:web:ebc7203ea570b0da2ad281"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const fetchReallocationData = async (): Promise<ReallocationData> => {
  try {
    const snapshot = await get(ref(database, 'reallocation'));
    return snapshot.val() || {};
  } catch (error) {
    console.error("Error fetching reallocation data:", error);
    return {};
  }
};

export const fetchDispatchData = async (): Promise<DispatchData> => {
  try {
    const snapshot = await get(ref(database, 'Dispatch'));
    return snapshot.val() || {};
  } catch (error) {
    console.error("Error fetching dispatch data:", error);
    return {};
  }
};

export const fetchScheduleData = async (): Promise<ScheduleData> => {
  try {
    const snapshot = await get(ref(database, 'schedule'));
    return snapshot.val() || [];
  } catch (error) {
    console.error("Error fetching schedule data:", error);
    return [];
  }
};

export const reportError = async (chassisNo: string, errorDetails: string): Promise<boolean> => {
  try {
    const errorData = {
      chassisNo,
      errorDetails,
      timestamp: new Date().toISOString(),
      status: "reported"
    };
    await push(ref(database, 'dispatchError'), errorData);
    return true;
  } catch (error) {
    console.error("Error reporting error:", error);
    return false;
  }
};

export const processReallocationData = (
  reallocationData: ReallocationData,
  scheduleData: ScheduleData
): ProcessedReallocationEntry[] => {
  const processed: ProcessedReallocationEntry[] = [];
  
  // Create a map of chassis to regent production status from schedule data
  const chassisToRegentProduction = new Map<string, string>();
  scheduleData.forEach(entry => {
    chassisToRegentProduction.set(entry.Chassis, entry["Regent Production"]);
  });

  Object.entries(reallocationData).forEach(([chassisNumber, entries]) => {
    // Get the latest entry for this chassis (by submitTime)
    const entryIds = Object.keys(entries);
    if (entryIds.length === 0) return;

    const latestEntryId = entryIds.reduce((latest, current) => {
      const latestTime = new Date(entries[latest].submitTime);
      const currentTime = new Date(entries[current].submitTime);
      return currentTime > latestTime ? current : latest;
    });

    const latestEntry = entries[latestEntryId];
    
    // Check if this chassis should be excluded based on schedule's Regent Production status
    const regentProduction = chassisToRegentProduction.get(chassisNumber);
    if (regentProduction === "Finished") {
      return; // Skip this entry
    }

    processed.push({
      ...latestEntry,
      chassisNumber,
      entryId: latestEntryId,
      regentProduction: regentProduction || "N/A"
    });
  });

  return processed;
};

export const validateDealerCheck = (
  sapData: string | undefined,
  scheduledDealer: string | undefined,
  reallocatedTo: string | undefined
): string => {
  // If all three fields are the same (and not empty), return OK
  if (sapData && scheduledDealer && reallocatedTo && 
      sapData === scheduledDealer && scheduledDealer === reallocatedTo) {
    return "OK";
  }
  
  // If SAP Data and Scheduled Dealer are the same but no reallocation, return OK
  if (sapData && scheduledDealer && sapData === scheduledDealer && !reallocatedTo) {
    return "OK";
  }
  
  return "Mismatch";
};

export const processDispatchData = (
  dispatchData: DispatchData,
  reallocationData: ReallocationData
): ProcessedDispatchEntry[] => {
  const processed: ProcessedDispatchEntry[] = [];
  
  // Create a map of chassis to reallocatedTo from reallocation data
  const chassisToReallocatedTo = new Map<string, string>();
  Object.entries(reallocationData).forEach(([chassisNumber, entries]) => {
    const entryIds = Object.keys(entries);
    if (entryIds.length > 0) {
      // Get the latest entry
      const latestEntryId = entryIds.reduce((latest, current) => {
        const latestTime = new Date(entries[latest].submitTime);
        const currentTime = new Date(entries[current].submitTime);
        return currentTime > latestTime ? current : latest;
      });
      chassisToReallocatedTo.set(chassisNumber, entries[latestEntryId].reallocatedTo);
    }
  });

  Object.entries(dispatchData).forEach(([chassisNo, entry]) => {
    const reallocatedTo = chassisToReallocatedTo.get(chassisNo);
    
    // Validate dealer check based on three-way comparison
    const validatedDealerCheck = validateDealerCheck(
      entry["SAP Data"],
      entry["Scheduled Dealer"],
      reallocatedTo
    );
    
    processed.push({
      ...entry,
      DealerCheck: validatedDealerCheck,
      ...(reallocatedTo && { reallocatedTo })
    });
  });

  return processed;
};

const isSnowyStock = (entry: ProcessedDispatchEntry, chassisToReallocatedTo: Map<string, string>) => {
  const reallocatedTo = chassisToReallocatedTo.get(entry["Chassis No"]);
  
  // If Reallocation To is "Snowy Stock", it's considered Snowy Stock
  if (reallocatedTo === "Snowy Stock") {
    return true;
  }
  
  // Original logic: Scheduled Dealer is "Snowy Stock" with OK checks and no reallocation or reallocation to Snowy Stock
  return entry["Scheduled Dealer"] === "Snowy Stock" &&
         entry.Statuscheck === "OK" &&
         entry.DealerCheck === "OK" &&
         (!reallocatedTo || reallocatedTo.trim() === "");
};

export const getDispatchStats = (dispatchData: DispatchData, reallocationData: ReallocationData) => {
  const entries = Object.values(dispatchData);
  const total = entries.length;
  const okStatus = entries.filter(entry => entry.Statuscheck === "OK").length;
  const invalidStock = entries.filter(entry => entry.Statuscheck !== "OK").length;
  
  // Create a map of chassis to reallocatedTo from reallocation data
  const chassisToReallocatedTo = new Map<string, string>();
  Object.entries(reallocationData).forEach(([chassisNumber, entryObj]) => {
    const entryIds = Object.keys(entryObj);
    if (entryIds.length > 0) {
      const latestEntryId = entryIds.reduce((latest, current) => {
        const latestTime = new Date(entryObj[latest].submitTime);
        const currentTime = new Date(entryObj[current].submitTime);
        return currentTime > latestTime ? current : latest;
      });
      chassisToReallocatedTo.set(chassisNumber, entryObj[latestEntryId].reallocatedTo);
    }
  });

  // Process entries with validated dealer check
  const processedEntries = entries.map(entry => {
    const reallocatedTo = chassisToReallocatedTo.get(entry["Chassis No"]);
    const validatedDealerCheck = validateDealerCheck(
      entry["SAP Data"],
      entry["Scheduled Dealer"],
      reallocatedTo
    );
    return { ...entry, DealerCheck: validatedDealerCheck, reallocatedTo };
  });

  // Calculate Snowy Stock
  const snowyStock = processedEntries.filter(entry => isSnowyStock(entry, chassisToReallocatedTo)).length;
  
  // Calculate Can be Dispatched: Status Check OK but excluding Snowy Stock
  const canBeDispatched = processedEntries.filter(entry => 
    entry.Statuscheck === "OK" && !isSnowyStock(entry, chassisToReallocatedTo)
  ).length;
  
  return {
    total,
    okStatus,
    invalidStock,
    snowyStock,
    canBeDispatched
  };
};

export const filterDispatchData = (
  data: ProcessedDispatchEntry[],
  filter: string,
  reallocationData: ReallocationData
): ProcessedDispatchEntry[] => {
  if (filter === 'all') return data;
  
  if (filter === 'ok') {
    return data.filter(entry => entry.Statuscheck === "OK");
  }
  
  if (filter === 'invalid') {
    return data.filter(entry => entry.Statuscheck !== "OK");
  }
  
  // Create a map of chassis to reallocatedTo from reallocation data
  const chassisToReallocatedTo = new Map<string, string>();
  Object.entries(reallocationData).forEach(([chassisNumber, entryObj]) => {
    const entryIds = Object.keys(entryObj);
    if (entryIds.length > 0) {
      const latestEntryId = entryIds.reduce((latest, current) => {
        const latestTime = new Date(entryObj[latest].submitTime);
        const currentTime = new Date(entryObj[current].submitTime);
        return currentTime > latestTime ? current : latest;
      });
      chassisToReallocatedTo.set(chassisNumber, entryObj[latestEntryId].reallocatedTo);
    }
  });

  if (filter === 'snowy') {
    return data.filter(entry => isSnowyStock(entry, chassisToReallocatedTo));
  }
  
  if (filter === 'canBeDispatched') {
    return data.filter(entry => 
      entry.Statuscheck === "OK" && !isSnowyStock(entry, chassisToReallocatedTo)
    );
  }
  
  return data;
};

export const getGRDaysColor = (days: number): string => {
  if (days <= 7) return "bg-green-500"; // Green for 0-7 days
  if (days <= 14) return "bg-yellow-500"; // Yellow for 8-14 days
  if (days <= 30) return "bg-orange-500"; // Orange for 15-30 days
  return "bg-red-500"; // Red for 30+ days
};

export const getGRDaysWidth = (days: number, maxDays: number): number => {
  return Math.min((days / Math.max(maxDays, 1)) * 100, 100);
};