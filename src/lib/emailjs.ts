import emailjs from '@emailjs/browser';

// EmailJS configuration
const EMAILJS_CONFIG = {
  serviceId: 'service_q3qp9rz',
  templateId: 'template_99eg2eg',
  publicKey: 'Ox1_IwykSClDMOhqz',
  privateKey: 'Dg7xyuMhc-xtKQbROJT7H'
};

// Initialize EmailJS
emailjs.init(EMAILJS_CONFIG.publicKey);

export interface EmailData {
  chassisNo: string;
  sapData: string;
  scheduledDealer: string;
  reallocatedTo?: string;
  customer: string;
  model: string;
  statusCheck: string;
  dealerCheck: string;
  grDays: number;
}

export const sendReportEmail = async (data: EmailData): Promise<boolean> => {
  try {
    const templateParams = {
      chassis_no: data.chassisNo,
      sap_data: data.sapData || 'N/A',
      scheduled_dealer: data.scheduledDealer || 'N/A',
      reallocated_to: data.reallocatedTo || 'No Reallocation',
      customer: data.customer || 'N/A',
      model: data.model || 'N/A',
      status_check: data.statusCheck,
      dealer_check: data.dealerCheck,
      gr_days: data.grDays,
      report_date: new Date().toLocaleString(),
      issue_summary: `Dealer Check Mismatch detected for chassis ${data.chassisNo}`,
      to_name: 'Dispatch Team',
      from_name: 'Dispatch Dashboard System'
    };

    console.log('Sending email with params:', templateParams);

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    );

    console.log('Email sent successfully:', response);
    return response.status === 200;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
};

export const testEmailConnection = async (): Promise<boolean> => {
  try {
    const testParams = {
      chassis_no: 'TEST-001',
      sap_data: 'Test SAP Data',
      scheduled_dealer: 'Test Dealer',
      reallocated_to: 'Test Reallocation',
      customer: 'Test Customer',
      model: 'Test Model',
      status_check: 'Test',
      dealer_check: 'Test',
      gr_days: 0,
      report_date: new Date().toLocaleString(),
      issue_summary: 'Email connection test',
      to_name: 'Test Recipient',
      from_name: 'Dispatch Dashboard System'
    };

    const response = await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      testParams,
      EMAILJS_CONFIG.publicKey
    );

    return response.status === 200;
  } catch (error) {
    console.error('Email connection test failed:', error);
    return false;
  }
};