export interface ReallocationEntry {
  customer: string;
  model: string;
  originalDealer: string;
  reallocatedTo: string;
  status: string;
  submitTime: string;
  signedPlansReceived: string;
  issue?: {
    type: string;
  };
}

export interface ProcessedReallocationEntry extends ReallocationEntry {
  chassisNumber: string;
  entryId: string;
  regentProduction: string;
}

export interface ReallocationData {
  [chassisNumber: string]: {
    [entryId: string]: ReallocationEntry;
  };
}

export interface DispatchEntry {
  "Chassis No": string;
  "GR to GI Days": number;
  Customer: string;
  Model?: string;
  "Matched PO No"?: string;
  "SAP Data"?: string;
  "Scheduled Dealer"?: string;
  Statuscheck: string;
  DealerCheck: string;
}

export interface ProcessedDispatchEntry extends DispatchEntry {
  reallocatedTo?: string;
}

export interface DispatchData {
  [chassisNo: string]: DispatchEntry;
}

export interface ScheduleEntry {
  Chassis: string;
  "Regent Production": string;
}

export type ScheduleData = ScheduleEntry[];