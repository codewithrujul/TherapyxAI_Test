import { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import PageHeader from '../components/PageHeader';
import TherapistOwnProfileView from '../components/therapist/TherapistOwnProfileView';
import { formatINR } from '../lib/currency';

const DAYS_CONFIG = [
  { dayOfWeek: 0, dayName: 'Sunday' },
  { dayOfWeek: 1, dayName: 'Monday' },
  { dayOfWeek: 2, dayName: 'Tuesday' },
  { dayOfWeek: 3, dayName: 'Wednesday' },
  { dayOfWeek: 4, dayName: 'Thursday' },
  { dayOfWeek: 5, dayName: 'Friday' },
  { dayOfWeek: 6, dayName: 'Saturday' },
];

const INITIAL_WORKING_HOURS = DAYS_CONFIG.map((d) => ({
  dayOfWeek: d.dayOfWeek,
  dayName: d.dayName,
  isActive: d.dayOfWeek >= 1 && d.dayOfWeek <= 6, // Mon-Sat default active
  startTime: '09:00',
  endTime: '17:00',
}));

export default function TherapistDashboardPage({ token, onBack, onSignOut, onSessionExpired }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isTokenExpiredState, setIsTokenExpiredState] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'confirmed' | 'clients' | 'pending' | 'completed' | 'all' | 'availability'
  const [showProfile, setShowProfile] = useState(false); // read-only "My Profile" view, opened from the header user menu
  const [clientSubTab, setClientSubTab] = useState('active'); // 'active' | 'completed' | 'all'
  const [clientHistoryTab, setClientHistoryTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'all'
  const [cancellingAptId, setCancellingAptId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Client Detail Modal & Clinical Notes State
  const [selectedClient, setSelectedClient] = useState(null);
  const [editingNotesAptId, setEditingNotesAptId] = useState(null);
  const [remarksInputText, setRemarksInputText] = useState('');
  const [suggestionsInputText, setSuggestionsInputText] = useState('');
  const [prescriptionInputText, setPrescriptionInputText] = useState('');
  const [savingNotesId, setSavingNotesId] = useState(null);
  const [completingTreatmentUserId, setCompletingTreatmentUserId] = useState(null);

  // Dedicated Session Completion Modal State
  const [completingSessionApt, setCompletingSessionApt] = useState(null);
  const [completingRemarksText, setCompletingRemarksText] = useState('');
  const [completingSuggestionsText, setCompletingSuggestionsText] = useState('');
  const [completingPrescriptionText, setCompletingPrescriptionText] = useState('');
  const [completingSessionLoading, setCompletingSessionLoading] = useState(false);

  // Availability / Unavailability Management State
  const [availSubTab, setAvailSubTab] = useState('working_hours'); // 'working_hours' | 'specific_dates'
  const [workingHoursSchedule, setWorkingHoursSchedule] = useState(INITIAL_WORKING_HOURS);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(false);
  const [workingHoursSaving, setWorkingHoursSaving] = useState(false);
  const [workingHoursError, setWorkingHoursError] = useState('');

  const [timeOffList, setTimeOffList] = useState([]);
  const [timeOffLoading, setTimeOffLoading] = useState(false);
  const [timeOffSaving, setTimeOffSaving] = useState(false);
  const [timeOffError, setTimeOffError] = useState('');

  const getTodayIST = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    return formatter.format(new Date());
  };

  const [calendarDate, setCalendarDate] = useState(getTodayIST());
  const [blockDate, setBlockDate] = useState(getTodayIST());
  const [isFullDay, setIsFullDay] = useState(true);
  const [startTimeVal, setStartTimeVal] = useState('14:00');
  const [endTimeVal, setEndTimeVal] = useState('17:00');
  const [blockReason, setBlockReason] = useState('');

  // Reschedule Modal State
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(getTodayIST());
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const handleRescheduleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!reschedulingApt || !rescheduleDate || !rescheduleTime) return;

    setRescheduleLoading(true);
    setRescheduleError('');

    try {
      const newStartTime = new Date(`${rescheduleDate}T${rescheduleTime}:00+05:30`).toISOString();
      const res = await fetch(`${API_BASE}/therapist/appointments/${reschedulingApt.id}/reschedule`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newStartTime }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to reschedule appointment');
      }

      showToast('✓ Session rescheduled successfully!');
      setReschedulingApt(null);
      fetchAssignedAppointments();
    } catch (err) {
      setRescheduleError(err.message || 'Failed to reschedule appointment.');
    } finally {
      setRescheduleLoading(false);
    }
  };

  const fetchWorkingHours = async () => {
    if (!token) return;
    setWorkingHoursLoading(true);
    setWorkingHoursError('');
    try {
      const res = await fetch(`${API_BASE}/therapist/working-hours`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.workingHours) {
        if (json.workingHours.length > 0) {
          const merged = DAYS_CONFIG.map((d) => {
            const found = json.workingHours.find((row) => Number(row.day_of_week) === d.dayOfWeek);
            if (found) {
              return {
                dayOfWeek: d.dayOfWeek,
                dayName: d.dayName,
                isActive: found.is_active !== false,
                startTime: (found.start_time || '09:00').slice(0, 5),
                endTime: (found.end_time || '17:00').slice(0, 5),
              };
            }
            return {
              dayOfWeek: d.dayOfWeek,
              dayName: d.dayName,
              isActive: false,
              startTime: '09:00',
              endTime: '17:00',
            };
          });
          setWorkingHoursSchedule(merged);
        } else {
          setWorkingHoursSchedule(INITIAL_WORKING_HOURS);
        }
      }
    } catch (err) {
      console.error('[TherapistDashboardPage] fetchWorkingHours error:', err);
    } finally {
      setWorkingHoursLoading(false);
    }
  };

  const handleSaveWorkingHours = async (e) => {
    if (e) e.preventDefault();
    setWorkingHoursError('');
    setWorkingHoursSaving(true);

    try {
      const payloadSchedule = workingHoursSchedule.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        isActive: item.isActive,
      }));

      const res = await fetch(`${API_BASE}/therapist/working-hours`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schedule: payloadSchedule }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to update working hours schedule');
      }

      showToast('✓ General working hours saved successfully!');
      fetchWorkingHours();
    } catch (err) {
      setWorkingHoursError(err.message || 'Failed to update working hours.');
    } finally {
      setWorkingHoursSaving(false);
    }
  };

  const applyPreset = (presetType) => {
    setWorkingHoursError('');
    if (presetType === 'mon_sat_9_5') {
      setWorkingHoursSchedule(
        DAYS_CONFIG.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          dayName: d.dayName,
          isActive: d.dayOfWeek >= 1 && d.dayOfWeek <= 6,
          startTime: '09:00',
          endTime: '17:00',
        }))
      );
    } else if (presetType === 'mon_fri_9_5') {
      setWorkingHoursSchedule(
        DAYS_CONFIG.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          dayName: d.dayName,
          isActive: d.dayOfWeek >= 1 && d.dayOfWeek <= 5,
          startTime: '09:00',
          endTime: '17:00',
        }))
      );
    } else if (presetType === 'mon_sun_8_8') {
      setWorkingHoursSchedule(
        DAYS_CONFIG.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          dayName: d.dayName,
          isActive: true,
          startTime: '08:00',
          endTime: '20:00',
        }))
      );
    }
  };

  const handleDayToggle = (dayOfWeek) => {
    setWorkingHoursSchedule((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, isActive: !item.isActive } : item))
    );
  };

  const handleDayTimeChange = (dayOfWeek, field, value) => {
    setWorkingHoursSchedule((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, [field]: value } : item))
    );
  };

  const fetchTimeOff = async () => {
    if (!token) return;
    setTimeOffLoading(true);
    try {
      const res = await fetch(`${API_BASE}/therapist/availability`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.timeOff) {
        setTimeOffList(json.timeOff);
      }
    } catch (err) {
      console.error('[TherapistDashboardPage] fetchTimeOff error:', err);
    } finally {
      setTimeOffLoading(false);
    }
  };

  const handleRetry = () => {
    const isTokenErr =
      isTokenExpiredState ||
      errorMsg.toLowerCase().includes('token') ||
      errorMsg.toLowerCase().includes('expired') ||
      errorMsg.toLowerCase().includes('log in') ||
      errorMsg.toLowerCase().includes('unauthorized');

    if (isTokenErr) {
      if (onSessionExpired) {
        onSessionExpired();
      } else if (onSignOut) {
        onSignOut();
      } else {
        localStorage.clear();
        window.location.href = '/therapist/auth';
      }
      return;
    }
    fetchAssignedAppointments();
  };

  const handleJoinMeeting = async (appointmentId) => {
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/meeting-link`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Cannot launch meeting at this time');
      }
      if (json.googleMeetUrl) {
        window.open(json.googleMeetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      showToast(err.message || 'Access to meeting link failed');
    }
  };

  const fetchAssignedAppointments = async () => {
    setLoading(true);
    setErrorMsg('');
    setIsTokenExpiredState(false);
    try {
      const res = await fetch(`${API_BASE}/therapist/appointments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.error?.message || 'Failed to fetch assigned appointments';
        if (res.status === 401 || msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('log in')) {
          setIsTokenExpiredState(true);
        }
        throw new Error(msg);
      }
      setAppointments(json.appointments || []);
    } catch (err) {
      console.error('[TherapistDashboardPage] Fetch failed:', err);
      setErrorMsg(err.message || 'Could not load assigned appointments.');
    } finally {
      setLoading(false);
    }
  };

  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    if (token) {
      fetchAssignedAppointments();
      fetchTimeOff();
      fetchWorkingHours();
    } else {
      setLoading(false);
    }
  }, [token]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleSaveDoctorNotesAndPrescription = async (appointmentId) => {
    setSavingNotesId(appointmentId);
    try {
      const res = await fetch(`${API_BASE}/therapist/appointments/${appointmentId}/notes`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicalNotes: remarksInputText,
          doctorRemarks: remarksInputText,
          doctorSuggestions: suggestionsInputText,
          doctorPrescription: prescriptionInputText,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to save doctor remarks & prescriptions');
      }

      const updatedApt = json.appointment || {};
      const newRemarks = updatedApt.clinical_notes || remarksInputText;
      const newSuggestions = updatedApt.doctor_suggestions || suggestionsInputText;
      const newPrescription = updatedApt.doctor_prescription || prescriptionInputText;

      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId
            ? {
                ...apt,
                clinical_notes: newRemarks,
                doctor_remarks: newRemarks,
                doctor_suggestions: newSuggestions,
                doctor_prescription: newPrescription,
              }
            : apt
        )
      );

      if (selectedClient) {
        const updateApt = (apt) =>
          apt.id === appointmentId
            ? {
                ...apt,
                clinical_notes: newRemarks,
                doctor_remarks: newRemarks,
                doctor_suggestions: newSuggestions,
                doctor_prescription: newPrescription,
              }
            : apt;

        setSelectedClient((prev) => ({
          ...prev,
          appointments: prev.appointments.map(updateApt),
          allAppointmentsSorted: prev.allAppointmentsSorted.map(updateApt),
          completedAppointments: prev.completedAppointments.map(updateApt),
        }));
      }

      setEditingNotesAptId(null);
      showToast('✓ Doctor remarks, suggestions & prescription saved successfully!');
    } catch (err) {
      console.error('[TherapistDashboardPage] Save notes failed:', err);
      showToast(err.message || 'Could not save session remarks.');
    } finally {
      setSavingNotesId(null);
    }
  };

  const handleCompletePatientTreatment = async (patientUserId) => {
    setCompletingTreatmentUserId(patientUserId);
    try {
      const res = await fetch(`${API_BASE}/therapist/patients/${patientUserId}/complete-treatment`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to mark patient treatment as completed');
      }

      setAppointments((prev) =>
        prev.map((apt) => (apt.user_id === patientUserId ? { ...apt, treatment_status: 'completed' } : apt))
      );

      if (selectedClient && selectedClient.clientId === patientUserId) {
        setSelectedClient((prev) => ({
          ...prev,
          isTreatmentCompleted: true,
          appointments: prev.appointments.map((a) => ({ ...a, treatment_status: 'completed' })),
          allAppointmentsSorted: prev.allAppointmentsSorted.map((a) => ({ ...a, treatment_status: 'completed' })),
        }));
      }

      showToast('✓ Patient treatment journey marked as COMPLETED!');
    } catch (err) {
      console.error('[TherapistDashboardPage] Complete treatment error:', err);
      showToast(err.message || 'Could not mark patient treatment as completed.');
    } finally {
      setCompletingTreatmentUserId(null);
    }
  };

  const openCompleteSessionModal = (apt) => {
    setCompletingSessionApt(apt);
    setCompletingRemarksText(apt.clinical_notes || apt.doctor_remarks || '');
    setCompletingSuggestionsText(apt.doctor_suggestions || '');
    setCompletingPrescriptionText(apt.doctor_prescription || '');
  };

  const handleConfirmCompleteSession = async (e) => {
    e.preventDefault();
    if (!completingSessionApt) return;

    const aptId = completingSessionApt.id;
    setCompletingSessionLoading(true);

    try {
      // 1. Save clinical remarks, suggestions, and prescriptions if entered
      await fetch(`${API_BASE}/therapist/appointments/${aptId}/notes`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicalNotes: completingRemarksText,
          doctorRemarks: completingRemarksText,
          doctorSuggestions: completingSuggestionsText,
          doctorPrescription: completingPrescriptionText,
        }),
      });

      // 2. Mark appointment status as completed
      const statusRes = await fetch(`${API_BASE}/therapist/appointments/${aptId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!statusRes.ok) {
        const errJson = await statusRes.json();
        throw new Error(errJson.error?.message || 'Failed to update session status to completed');
      }

      showToast('✓ Session marked as COMPLETED with remarks & prescription!');
      setCompletingSessionApt(null);
      setCompletingRemarksText('');
      setCompletingSuggestionsText('');
      setCompletingPrescriptionText('');

      // Refresh appointments state
      await fetchAssignedAppointments();

      // If selectedClient modal is active, update selectedClient appointments
      if (selectedClient) {
        const updateApt = (a) =>
          a.id === aptId
            ? {
                ...a,
                status: 'completed',
                clinical_notes: completingRemarksText,
                doctor_remarks: completingRemarksText,
                doctor_suggestions: completingSuggestionsText,
                doctor_prescription: completingPrescriptionText,
              }
            : a;

        setSelectedClient((prev) => ({
          ...prev,
          appointments: prev.appointments.map(updateApt),
          allAppointmentsSorted: prev.allAppointmentsSorted.map(updateApt),
          completedAppointments: prev.completedAppointments ? prev.completedAppointments.map(updateApt) : [],
        }));
      }
    } catch (err) {
      console.error('[TherapistDashboardPage] handleConfirmCompleteSession error:', err);
      showToast(err.message || 'Could not complete session.');
    } finally {
      setCompletingSessionLoading(false);
    }
  };

  const handleAddTimeOff = async (e) => {
    e.preventDefault();
    setTimeOffError('');
    setTimeOffSaving(true);

    try {
      const payload = {
        date: blockDate,
        isFullDay,
        startTime: isFullDay ? undefined : startTimeVal,
        endTime: isFullDay ? undefined : endTimeVal,
        reason: blockReason || (isFullDay ? 'Full day unavailable' : 'Partial day unavailable'),
      };

      const res = await fetch(`${API_BASE}/therapist/availability`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to set unavailability');
      }

      showToast('Unavailability period saved!');
      setBlockReason('');
      fetchTimeOff();
    } catch (err) {
      console.error('[TherapistDashboardPage] handleAddTimeOff error:', err);
      setTimeOffError(err.message || 'Could not save unavailability period');
    } finally {
      setTimeOffSaving(false);
    }
  };

  const handleDeleteTimeOff = async (timeOffId) => {
    try {
      const res = await fetch(`${API_BASE}/therapist/availability/${timeOffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to remove unavailability record');
      }
      showToast('Unavailability period removed.');
      fetchTimeOff();
    } catch (err) {
      console.error('[TherapistDashboardPage] handleDeleteTimeOff error:', err);
      showToast(err.message || 'Could not remove unavailability period');
    }
  };

  const formatTimeOffPeriod = (startISO, endISO) => {
    if (!startISO || !endISO) return { dateStr: '', timeRangeStr: '' };
    try {
      const startD = new Date(startISO);
      const endD = new Date(endISO);
      const dateStr = startD.toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const startTimeStr = startD.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTimeStr = endD.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });
      const isFullDayRange = (startTimeStr.includes('12:00 AM') || startTimeStr.includes('00:00')) &&
        (endTimeStr.includes('11:59 PM') || endTimeStr.includes('12:00 AM') || endTimeStr.includes('23:59'));

      return {
        dateStr,
        timeRangeStr: isFullDayRange ? 'Entire Day (Full Day Unavailable)' : `${startTimeStr} – ${endTimeStr}`,
      };
    } catch {
      return { dateStr: startISO, timeRangeStr: endISO };
    }
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    setActionLoadingId(appointmentId);
    try {
      const res = await fetch(`${API_BASE}/therapist/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || `Failed to update status to ${newStatus}`);
      }

      fetchAssignedAppointments();
      showToast(`Appointment status updated to ${newStatus}.`);
    } catch (err) {
      console.error('[TherapistDashboardPage] Status update failed:', err);
      showToast(err.message || 'Action failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelByTherapist = async (e) => {
    e.preventDefault();
    if (!cancellingAptId) return;

    setActionLoadingId(cancellingAptId);
    try {
      const res = await fetch(`${API_BASE}/therapist/appointments/${cancellingAptId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to cancel appointment');
      }

      fetchAssignedAppointments();
      setCancellingAptId(null);
      setCancelReason('');
      showToast('Appointment cancelled successfully.');
    } catch (err) {
      console.error('[TherapistDashboardPage] Cancel failed:', err);
      showToast(err.message || 'Could not cancel appointment.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'Date TBD';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isAppointmentCompleted = (apt) => {
    if (!apt) return false;
    if (apt.status === 'completed') return true;
    if (apt.status === 'cancelled') return false;
    const endTs = new Date(apt.end_time || apt.start_time).getTime() + (apt.end_time ? 0 : 3600000);
    return !isNaN(endTs) && Date.now() > endTs;
  };

  const pendingCount = appointments.filter((a) => a.status === 'pending' && !isAppointmentCompleted(a)).length;
  const confirmedCount = appointments.filter((a) => a.status === 'confirmed' && !isAppointmentCompleted(a)).length;
  const completedCount = appointments.filter((a) => isAppointmentCompleted(a)).length;

  const getGroupedPendingRequests = () => {
    const pendingList = appointments.filter((a) => a.status === 'pending' && !isAppointmentCompleted(a));
    const groups = [];
    const processedPackageIds = new Set();

    pendingList.forEach((apt) => {
      if (apt.package_id) {
        if (!processedPackageIds.has(apt.package_id)) {
          processedPackageIds.add(apt.package_id);
          const pkgApts = appointments
            .filter((a) => a.package_id === apt.package_id)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
          groups.push({
            isPackage: true,
            packageId: apt.package_id,
            patient: apt.profiles || {},
            primaryAppointment: pkgApts[0] || apt,
            sessions: pkgApts,
            totalSessionsCount: pkgApts.length,
            totalFee: pkgApts.reduce((sum, item) => sum + (Number(item.fee_amount) || 0), 0),
          });
        }
      } else {
        groups.push({
          isPackage: false,
          primaryAppointment: apt,
          patient: apt.profiles || {},
          sessions: [apt],
          totalSessionsCount: 1,
          totalFee: Number(apt.fee_amount) || 0,
        });
      }
    });

    return groups;
  };

  const getClientsList = () => {
    const clientsMap = new Map();
    appointments.forEach((apt) => {
      const patient = apt.profiles || {};
      const clientId = apt.user_id || patient.id || patient.email || 'unknown';

      if (!clientsMap.has(clientId)) {
        clientsMap.set(clientId, {
          clientId,
          name: patient.name || 'Client Practitioner Session',
          email: patient.email || 'client@example.com',
          appointments: [],
        });
      }
      clientsMap.get(clientId).appointments.push(apt);
    });

    return Array.from(clientsMap.values()).map((client) => {
      const allApts = client.appointments;
      const completedApts = allApts.filter((a) => isAppointmentCompleted(a));
      const upcomingApts = allApts.filter((a) => (a.status === 'pending' || a.status === 'confirmed') && !isAppointmentCompleted(a));
      const pendingApts = allApts.filter((a) => a.status === 'pending' && !isAppointmentCompleted(a));
      const isTreatmentCompleted = allApts.some(a => a.treatment_status === 'completed');
      const hasConfirmed = allApts.some((a) => a.status === 'confirmed' || a.status === 'completed');

      const isCompleted = isTreatmentCompleted;
      const isActive = hasConfirmed && !isTreatmentCompleted;

      return {
        ...client,
        totalSessions: allApts.length,
        completedCount: completedApts.length,
        upcomingCount: upcomingApts.length,
        pendingCount: pendingApts.length,
        isTreatmentCompleted,
        hasConfirmed,
        isActive,
        isCompleted,
        upcomingAppointments: upcomingApts.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
        completedAppointments: completedApts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
        allAppointmentsSorted: allApts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)),
      };
    });
  };

  const getUpcomingClientsList = () => {
    const clientsMap = new Map();
    appointments.forEach((apt) => {
      const isComp = isAppointmentCompleted(apt);
      if ((apt.status === 'confirmed' || apt.status === 'pending') && apt.status !== 'cancelled' && !isComp) {
        const patient = apt.profiles || {};
        const clientId = apt.user_id || patient.id || patient.email || 'unknown';

        if (!clientsMap.has(clientId)) {
          clientsMap.set(clientId, {
            clientId,
            name: patient.name || 'Client Practitioner Session',
            email: patient.email || 'client@example.com',
            appointments: [],
          });
        }
        clientsMap.get(clientId).appointments.push(apt);
      }
    });

    return Array.from(clientsMap.values()).map((client) => {
      const sortedApts = client.appointments.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      const latestTs = sortedApts.length > 0 ? new Date(sortedApts[0].start_time).getTime() : 0;
      return {
        ...client,
        upcomingCount: sortedApts.length,
        appointments: sortedApts,
        latestTs,
      };
    }).sort((a, b) => b.latestTs - a.latestTs);
  };

  const getCalendarDateAppointments = (targetDateStr) => {
    return appointments.filter((apt) => {
      if (!apt.start_time || apt.status === 'cancelled') return false;
      try {
        const aptDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(apt.start_time));
        return aptDateStr === targetDateStr;
      } catch {
        return false;
      }
    }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  };

  const handlePrevCalendarDay = () => {
    try {
      const d = new Date(calendarDate + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
      setCalendarDate(formatter.format(d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNextCalendarDay = () => {
    try {
      const d = new Date(calendarDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
      setCalendarDate(formatter.format(d));
    } catch (e) {
      console.error(e);
    }
  };

  const handleTodayCalendarDay = () => {
    setCalendarDate(getTodayIST());
  };

  const getMonthDatesWithCounts = () => {
    const parts = calendarDate.split('-');
    const year = parseInt(parts[0] || '2026', 10);
    const month = parseInt(parts[1] || '09', 10) - 1;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const countsMap = new Map();
    appointments.forEach((apt) => {
      if (!apt.start_time || apt.status === 'cancelled') return;
      try {
        const aptDateStr = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(apt.start_time));
        countsMap.set(aptDateStr, (countsMap.get(aptDateStr) || 0) + 1);
      } catch {}
    });

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateFormatted,
        count: countsMap.get(dateFormatted) || 0,
        isSelected: dateFormatted === calendarDate,
        isToday: dateFormatted === getTodayIST(),
      });
    }
    return { days, monthName: firstDay.toLocaleString('en-US', { month: 'long', year: 'numeric' }) };
  };

  const filteredAppointments = appointments.filter((apt) => {
    const isComp = isAppointmentCompleted(apt);
    if (activeTab === 'pending') return apt.status === 'pending' && !isComp;
    if (activeTab === 'confirmed') return apt.status === 'confirmed' && !isComp;
    if (activeTab === 'completed') return isComp;
    return true;
  });

  const clientsList = getClientsList();
  const upcomingClientsList = getUpcomingClientsList();
  const totalUpcomingSessionsCount = upcomingClientsList.reduce((sum, c) => sum + c.upcomingCount, 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      {/* Header — shared across every internal page: product logo/icons + theme + portal badge */}
      <PageHeader
        onBack={onBack}
        showBack={false}
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary"><path d="M9 12v-2a3 3 0 1 1 6 0v2M6 12h12l-1 8H7l-1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
            <span>Practitioner Portal</span>
          </span>
        }
        token={token}
        onSignOut={onSignOut}
        onOpenMyProfile={() => { setShowProfile(true); window.scrollTo({ top: 0 }); }}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-foreground text-background text-xs font-bold shadow-2xl animate-fade-in flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6 animate-fade-up">
        {showProfile ? (
          /* ── MY PROFILE VIEW (read-only) — opened from the header user menu ── */
          <TherapistOwnProfileView
            token={token}
            onSessionExpired={onSessionExpired || onSignOut}
            onClose={() => setShowProfile(false)}
          />
        ) : selectedClient ? (
          /* ── DEDICATED INLINE CLIENT HISTORY PAGE VIEW ── */
          <div className="space-y-6 animate-fade-in font-sans">
            {/* Top Navigation / Back Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setSelectedClient(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-all flex items-center gap-2"
              >
                <span>← Back to practitioner dashboard</span>
              </button>
              <span className="text-xs font-normal text-muted-foreground">
                Client history record & clinical prescriptions
              </span>
            </div>

            {/* Client Profile Header Banner */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-medium text-lg">
                    {selectedClient.name ? selectedClient.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-normal text-foreground">{selectedClient.name}</h2>
                      {selectedClient.isTreatmentCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                          Treatment completed
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          Active treatment
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedClient.email}</p>
                  </div>
                </div>

                {!selectedClient.isTreatmentCompleted && (
                  <button
                    type="button"
                    disabled={completingTreatmentUserId === selectedClient.clientId}
                    onClick={() => handleCompletePatientTreatment(selectedClient.clientId)}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs transition-all flex items-center gap-2 shadow-sm"
                  >
                    <span>{completingTreatmentUserId === selectedClient.clientId ? 'Updating...' : 'Mark client treatment as completed'}</span>
                  </button>
                )}
              </div>

              {/* Client Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-muted/40 border border-border/40 text-center text-xs">
                <div>
                  <span className="text-xs font-normal text-muted-foreground block">Total sessions</span>
                  <span className="font-semibold text-foreground text-base mt-0.5 block">{selectedClient.totalSessions}</span>
                </div>
                <div>
                  <span className="text-xs font-normal text-muted-foreground block">Upcoming</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-base mt-0.5 block">{selectedClient.upcomingCount}</span>
                </div>
                <div>
                  <span className="text-xs font-normal text-muted-foreground block">Completed</span>
                  <span className="font-semibold text-sky-600 dark:text-sky-400 text-base mt-0.5 block">{selectedClient.completedCount}</span>
                </div>
                <div>
                  <span className="text-xs font-normal text-muted-foreground block">Pending</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400 text-base mt-0.5 block">{selectedClient.pendingCount}</span>
                </div>
              </div>
            </div>

            {/* Sessions History & Prescriptions Container */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                <h3 className="font-normal text-foreground text-base">
                  Clinical sessions & prescriptions log
                </h3>

                {/* Sub Navigation Tabs inside Client History */}
                <div className="flex items-center gap-4 text-xs border-b border-border/60 pb-px">
                  {[
                    { id: 'upcoming', label: `Upcoming sessions (${selectedClient.appointments.filter(a => !isAppointmentCompleted(a) && a.status !== 'cancelled').length})` },
                    { id: 'completed', label: `Completed sessions (${selectedClient.appointments.filter(a => isAppointmentCompleted(a)).length})` },
                    { id: 'all', label: `All (${selectedClient.appointments.length})` },
                  ].map((subTab) => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setClientHistoryTab(subTab.id)}
                      className={`py-2 border-b-2 font-medium transition-all ${
                        clientHistoryTab === subTab.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const upcomingApts = selectedClient.appointments
                  .filter(a => !isAppointmentCompleted(a) && a.status !== 'cancelled')
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                const completedApts = selectedClient.appointments
                  .filter(a => isAppointmentCompleted(a))
                  .sort((a, b) => (a.session_number || 0) - (b.session_number || 0) || new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                const allApts = selectedClient.appointments
                  .slice()
                  .sort((a, b) => (a.session_number || 0) - (b.session_number || 0) || new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

                const displayApts = clientHistoryTab === 'upcoming'
                  ? upcomingApts
                  : clientHistoryTab === 'completed'
                  ? completedApts
                  : allApts;

                if (displayApts.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-border/70 p-8 text-center space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {clientHistoryTab === 'upcoming'
                          ? 'No upcoming sessions'
                          : clientHistoryTab === 'completed'
                          ? 'No completed sessions'
                          : 'No sessions found'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {clientHistoryTab === 'upcoming'
                          ? 'This client has no upcoming session bookings at this time.'
                          : clientHistoryTab === 'completed'
                          ? 'No completed session logs or prescriptions recorded yet.'
                          : 'No appointments recorded for this client.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {displayApts.map((apt) => {
                      const isComp = isAppointmentCompleted(apt);
                      const isEditingNotes = editingNotesAptId === apt.id;

                      return (
                        <div key={apt.id} className="p-5 rounded-xl bg-muted/20 border border-border space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="font-semibold text-foreground text-sm block">{formatDateTime(apt.start_time)}</span>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                Ref: {apt.appointment_number || apt.id} {apt.session_number ? `· Session ${apt.session_number}` : ''}
                              </span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-md text-xs font-normal capitalize self-start sm:self-auto ${
                              isComp ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20' : apt.status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'
                            }`}>
                              {isComp ? 'Completed' : apt.status}
                            </span>
                          </div>

                          {apt.user_notes && (
                            <div className="text-xs text-muted-foreground p-3 rounded-xl bg-background border border-border">
                              <strong className="text-foreground font-medium">Client pre-session reason:</strong> "{apt.user_notes}"
                            </div>
                          )}

                          {/* Action buttons for upcoming session: Join Meet & Mark Completed */}
                          {!isComp && apt.status !== 'cancelled' && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                              <span className="text-xs font-medium text-foreground">
                                Upcoming session actions:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleJoinMeeting(apt.id)}
                                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <span>Launch Google Meet</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCompleteSessionModal(apt)}
                                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all flex items-center gap-1.5"
                                >
                                  <span>Mark session completed</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Recorded Remarks, Suggestions & Prescriptions */}
                          {!isEditingNotes && (apt.clinical_notes || apt.doctor_remarks || apt.doctor_suggestions || apt.doctor_prescription) && (
                            <div className="space-y-2 text-xs">
                              {(apt.clinical_notes || apt.doctor_remarks) && (
                                <div className="p-3 rounded-xl bg-muted/30 border border-border text-foreground">
                                  <strong className="block font-medium">Remarks:</strong>
                                  <p className="whitespace-pre-wrap mt-0.5 text-muted-foreground">{apt.doctor_remarks || apt.clinical_notes}</p>
                                </div>
                              )}
                              {apt.doctor_suggestions && (
                                <div className="p-3 rounded-xl bg-muted/30 border border-border text-foreground">
                                  <strong className="block font-medium">Suggestions:</strong>
                                  <p className="whitespace-pre-wrap mt-0.5 text-muted-foreground">{apt.doctor_suggestions}</p>
                                </div>
                              )}
                              {apt.doctor_prescription && (
                                <div className="p-3 rounded-xl bg-muted/30 border border-border text-foreground">
                                  <strong className="block font-medium">Prescription:</strong>
                                  <p className="whitespace-pre-wrap mt-0.5 text-muted-foreground">{apt.doctor_prescription}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Editor Button / Form */}
                          {!isEditingNotes ? (
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNotesAptId(apt.id);
                                  setRemarksInputText(apt.clinical_notes || apt.doctor_remarks || '');
                                  setSuggestionsInputText(apt.doctor_suggestions || '');
                                  setPrescriptionInputText(apt.doctor_prescription || '');
                                }}
                                className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all"
                              >
                                {(apt.clinical_notes || apt.doctor_remarks || apt.doctor_prescription) ? 'Update prescription and remarks' : 'Add prescription and remarks'}
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3 animate-fade-in">
                              <label className="block text-xs font-medium text-foreground">Doctor remarks and prescriptions for {formatDateTime(apt.start_time)}:</label>
                              
                              <div>
                                <label className="block text-xs font-normal text-muted-foreground mb-1">Session remarks:</label>
                                <textarea
                                  rows={2}
                                  value={remarksInputText}
                                  onChange={(e) => setRemarksInputText(e.target.value)}
                                  placeholder="Clinical session remarks..."
                                  className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-normal text-muted-foreground mb-1">Doctor suggestions:</label>
                                <textarea
                                  rows={2}
                                  value={suggestionsInputText}
                                  onChange={(e) => setSuggestionsInputText(e.target.value)}
                                  placeholder="Suggestions or advice..."
                                  className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-normal text-muted-foreground mb-1">Prescription:</label>
                                <textarea
                                  rows={2}
                                  value={prescriptionInputText}
                                  onChange={(e) => setPrescriptionInputText(e.target.value)}
                                  placeholder="Therapeutic prescription or care plan..."
                                  className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                                />
                              </div>

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingNotesAptId(null)}
                                  className="px-3.5 py-1.5 text-xs rounded-xl border border-border hover:bg-muted text-muted-foreground"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingNotesId === apt.id}
                                  onClick={() => handleSaveDoctorNotesAndPrescription(apt.id)}
                                  className="px-4 py-1.5 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                >
                                  {savingNotesId === apt.id ? 'Saving prescriptions...' : 'Save all prescriptions and remarks'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* ── STANDARD DASHBOARD & TABS VIEW ── */
          <div className="space-y-6 font-sans">
            {/* Banner */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-normal text-foreground tracking-tight">
                  Client appointment management
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Review client requests, launch Google Meet sessions, manage schedules, write prescriptions, and mark completed treatment journeys.
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:flex-initial p-3 rounded-xl bg-muted/30 border border-border text-center min-w-[95px]">
                  <span className="block text-lg font-semibold text-amber-600 dark:text-amber-400 leading-tight">{getGroupedPendingRequests().length}</span>
                  <span className="text-[11px] font-normal text-muted-foreground mt-1 block">Pending requests</span>
                </div>
                <div className="flex-1 sm:flex-initial p-3 rounded-xl bg-muted/30 border border-border text-center min-w-[95px]">
                  <span className="block text-lg font-semibold text-emerald-600 dark:text-emerald-400 leading-tight">{totalUpcomingSessionsCount}</span>
                  <span className="text-[11px] font-normal text-muted-foreground mt-1 block">Upcoming sessions</span>
                </div>
                <div className="flex-1 sm:flex-initial p-3 rounded-xl bg-muted/30 border border-border text-center min-w-[95px]">
                  <span className="block text-lg font-semibold text-foreground leading-tight">{clientsList.length}</span>
                  <span className="text-[11px] font-normal text-muted-foreground mt-1 block">Clients</span>
                </div>
              </div>
            </div>

            {/* Filter Navigation Tabs - Clean Horizontal Scrollable Container */}
            <div className="border-b border-border/80 overflow-x-auto scrollbar-none">
              <nav className="flex space-x-6 min-w-max pb-px" aria-label="Tabs">
                {[
                  { id: 'confirmed', label: `Upcoming sessions (${totalUpcomingSessionsCount})` },
                  { id: 'pending', label: `Pending requests (${getGroupedPendingRequests().length})` },
                  { id: 'clients', label: `Clients (${clientsList.length})` },
                  { id: 'calendar', label: 'Calendar' },
                  { id: 'availability', label: 'Availability' },
                  { id: 'completed', label: `Completed (${completedCount})` },
                  { id: 'all', label: `All bookings (${appointments.length})` },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 px-1 border-b-2 text-sm transition-colors whitespace-nowrap ${
                        isActive
                          ? 'border-primary text-primary font-medium'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border font-normal'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            {/* Error State */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
                <span>⚠️ {errorMsg}</span>
                <button
                  onClick={handleRetry}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold transition-all text-xs active:scale-95"
                >
                  {isTokenExpiredState || errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('log in') ? 'Log In Again' : 'Retry'}
                </button>
              </div>
            )}

        {/* ── 3. MY CLIENTS TAB VIEW ── */}
        {activeTab === 'clients' ? (
          <div className="space-y-6 animate-fade-in font-sans">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-normal text-foreground">Active & completed clients</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  View client session records, write doctor remarks/prescriptions, and mark completed patient treatment journeys.
                </p>
              </div>

              {/* Sub-tabs inside My Clients */}
              <div className="flex items-center gap-4 text-xs border-b border-border/60 pb-px">
                {[
                  { id: 'active', label: `Active (${clientsList.filter((c) => c.isActive).length})` },
                  { id: 'completed', label: `Completed (${clientsList.filter((c) => c.isCompleted || c.isTreatmentCompleted).length})` },
                  { id: 'all', label: `All (${clientsList.length})` },
                ].map((subTab) => (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => setClientSubTab(subTab.id)}
                    className={`py-2 border-b-2 font-medium transition-all ${
                      clientSubTab === subTab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const displayClients =
                clientSubTab === 'active'
                  ? clientsList.filter((c) => c.isActive)
                  : clientSubTab === 'completed'
                  ? clientsList.filter((c) => c.isCompleted || c.isTreatmentCompleted)
                  : clientsList;

              if (displayClients.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-border/70 p-12 text-center space-y-2">
                    <h3 className="text-base font-normal">No clients found</h3>
                    <p className="text-xs text-muted-foreground">
                      {clientSubTab === 'active'
                        ? 'No active client treatment journeys found. (Clients become active once an appointment is confirmed).'
                        : clientSubTab === 'completed'
                        ? 'No completed client treatment journeys found.'
                        : "You don't have any client bookings yet."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {displayClients.map((client) => (
                    <div
                      key={client.clientId}
                      className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-medium text-base">
                            {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <h3 className="text-base font-normal text-foreground">{client.name}</h3>
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          </div>
                        </div>

                        {client.isTreatmentCompleted ? (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                            Completed
                          </span>
                        ) : client.isActive ? (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Pending booking
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/30 border border-border text-center text-xs">
                        <div>
                          <span className="text-[11px] font-normal text-muted-foreground block">Total sessions</span>
                          <span className="font-semibold text-foreground mt-0.5 block">{client.totalSessions}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-normal text-muted-foreground block">Upcoming</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">{client.upcomingCount}</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-normal text-muted-foreground block">Completed</span>
                          <span className="font-semibold text-sky-600 dark:text-sky-400 mt-0.5 block">{client.completedCount}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClient(client)}
                          className="w-full py-2 px-4 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          <span>View client history & prescriptions</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'pending' ? (
          /* ── 2. PENDING REQUESTS TAB ── */
          <div className="space-y-4 animate-fade-in font-sans">
            {getGroupedPendingRequests().length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-card p-12 text-center space-y-2">
                <h3 className="text-base font-normal">No pending requests</h3>
                <p className="text-xs text-muted-foreground">Your pending appointment or package booking requests will appear here.</p>
              </div>
            ) : (
              getGroupedPendingRequests().map((group) => {
                const patient = group.patient;
                const primaryApt = group.primaryAppointment;
                const isPkg = group.isPackage;

                return (
                  <div
                    key={group.packageId || primaryApt.id}
                    className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-medium text-base">
                          {patient.name ? patient.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-normal text-foreground">{patient.name || 'Client'}</h3>
                            {isPkg && (
                              <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {group.totalSessionsCount}-session package request
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{patient.email || 'Client'}</p>
                          <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                            Ref: {primaryApt.appointment_number || primaryApt.id}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-md text-xs font-normal bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        Pending confirmation
                      </span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/30 border border-border text-xs">
                      <div>
                        <span className="text-[11px] font-normal text-muted-foreground block">
                          {isPkg ? 'First session date' : 'Scheduled time'}
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 block">
                          {formatDateTime(primaryApt.start_time)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-normal text-muted-foreground block">
                          Session format & fee
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 block capitalize">
                          {primaryApt.session_type || 'Video'} ({isPkg ? `${group.totalSessionsCount} Sessions @ ${formatINR(group.totalFee)}` : formatINR(primaryApt.fee_amount)})
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-normal text-muted-foreground block">
                          Package sessions
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 block">
                          {isPkg ? `${group.totalSessionsCount} weekly sessions` : 'Single session'}
                        </span>
                      </div>
                    </div>

                    {/* Weekly Schedule for Multi-Session Packages */}
                    {isPkg && group.sessions.length > 0 && (
                      <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2 text-xs">
                        <span className="font-normal text-muted-foreground block mb-1">
                          Weekly session schedule requested by client:
                        </span>
                        <div className="space-y-1.5">
                          {group.sessions.map((s, idx) => (
                            <div key={s.id || idx} className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-card border border-border font-medium">
                              <span className="font-medium text-foreground">Session {idx + 1} of {group.totalSessionsCount}</span>
                              <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(s.start_time)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground p-3 rounded-xl bg-background border border-border">
                      <strong className="text-foreground font-medium">Reason for session:</strong>{' '}
                      {primaryApt.user_notes ? (
                        <span className="text-foreground font-normal">"{primaryApt.user_notes}"</span>
                      ) : (
                        <em className="text-muted-foreground font-normal">No reason provided</em>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                      <button
                        type="button"
                        disabled={actionLoadingId === primaryApt.id}
                        onClick={() => handleUpdateStatus(primaryApt.id, 'confirmed')}
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <span>Confirm booking</span>
                      </button>

                      {(new Date(primaryApt.start_time).getTime() - Date.now()) / (1000 * 60 * 60) >= 24 ? (
                        <button
                          type="button"
                          onClick={() => setCancellingAptId(primaryApt.id)}
                          className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all"
                        >
                          Decline request
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-muted-foreground text-xs font-normal">
                          Cancellation closed (&lt;24h to session)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === 'confirmed' ? (
          /* ── UPCOMING SESSIONS TAB ── */
          <div className="space-y-6 animate-fade-in font-sans">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-normal text-foreground">Upcoming client sessions</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  All upcoming & confirmed appointments across all clients, ordered by earliest session first.
                </p>
              </div>
              <span className="px-3 py-1 rounded-md text-xs font-normal bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 self-start sm:self-auto">
                {appointments.filter((apt) => (apt.status === 'confirmed' || apt.status === 'pending') && apt.status !== 'cancelled' && !isAppointmentCompleted(apt)).length} total upcoming sessions
              </span>
            </div>

            {(() => {
              const flatUpcomingList = appointments
                .filter((apt) => (apt.status === 'confirmed' || apt.status === 'pending') && apt.status !== 'cancelled' && !isAppointmentCompleted(apt))
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

              if (flatUpcomingList.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-border/70 bg-card p-12 text-center space-y-2">
                    <h3 className="text-base font-normal">No upcoming sessions</h3>
                    <p className="text-xs text-muted-foreground">Your upcoming sessions will appear here once a booking is confirmed.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {flatUpcomingList.map((apt) => {
                    const patient = apt.profiles || {};
                    const clientName = patient.name || 'Client';
                    const clientEmail = patient.email || 'client@example.com';
                    const statusLabel = apt.status;
                    const nowTs = Date.now();
                    const startTs = new Date(apt.start_time).getTime();
                    const endTs = new Date(apt.end_time).getTime();
                    const isBeforeStart = !isNaN(startTs) && nowTs < (startTs - 15 * 60000);
                    const isAfterSession = !isNaN(endTs) && nowTs >= endTs;
                    const isDuringSession = !isBeforeStart && !isAfterSession;

                    return (
                      <div
                        key={apt.id}
                        className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4"
                      >
                        {/* Client Info Header */}
                        <div className="flex flex-row items-center justify-between gap-3 pb-3.5 border-b border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-medium text-base shrink-0">
                              {clientName ? clientName.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-normal text-foreground">{clientName}</h3>
                                {apt.session_number && (
                                  <span className="px-2 py-0.5 rounded-md text-xs font-normal bg-muted text-muted-foreground border border-border">
                                    Session {apt.session_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{clientEmail}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const fullClient = clientsList.find(c => c.clientId === (apt.user_id || patient.id || patient.email)) || {
                                clientId: apt.user_id || patient.id || patient.email,
                                name: clientName,
                                email: clientEmail,
                                appointments: [apt],
                              };
                              setSelectedClient(fullClient);
                            }}
                            className="px-3.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all shrink-0"
                          >
                            <span>View details</span>
                          </button>
                        </div>

                        {/* Session Date & Time Info Box */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border text-xs">
                          <div>
                            <span className="text-[11px] font-normal text-muted-foreground block">Scheduled date and time</span>
                            <span className="font-semibold text-foreground text-sm mt-0.5 block">
                              {formatDateTime(apt.start_time)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] font-normal text-muted-foreground block">Format & fee</span>
                            <span className="font-semibold text-foreground mt-0.5 block capitalize">
                              Google Meet ({formatINR(apt.fee_amount || 0)})
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] font-normal text-muted-foreground block">Status</span>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-normal capitalize mt-0.5 ${
                                statusLabel === 'confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Reason for Session */}
                        <div className="text-xs text-muted-foreground p-3 rounded-xl bg-background border border-border">
                          <strong className="text-foreground font-medium">Reason for session:</strong>{' '}
                          {apt.user_notes ? (
                            <span className="text-foreground font-normal">"{apt.user_notes}"</span>
                          ) : (
                            <em className="text-muted-foreground font-normal">No reason provided</em>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                          {isDuringSession ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">Session active now</span>
                            </div>
                          ) : (
                            <div />
                          )}

                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setReschedulingApt(apt);
                                if (apt.start_time) {
                                  try {
                                    const d = new Date(apt.start_time);
                                    const dateStr = d.toISOString().split('T')[0];
                                    const timeStr = d.toTimeString().slice(0, 5);
                                    setRescheduleDate(dateStr);
                                    setRescheduleTime(timeStr);
                                  } catch (e) {}
                                }
                              }}
                              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all"
                            >
                              <span>Reschedule session</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openCompleteSessionModal(apt)}
                              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all"
                            >
                              <span>Mark as completed</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleJoinMeeting(apt.id)}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all text-xs"
                            >
                              <span>Launch Google Meet</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'calendar' ? (
          /* ── SCHEDULE CALENDAR TAB ── */
          <div className="space-y-6 animate-fade-in font-sans">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-normal text-muted-foreground">
                  Practitioner calendar & timeline
                </span>
                <h2 className="text-2xl font-normal text-foreground mt-1">
                  Schedule for {new Date(calendarDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevCalendarDay}
                  className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium transition-all"
                >
                  Prev day
                </button>
                <button
                  type="button"
                  onClick={handleTodayCalendarDay}
                  className={`px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
                    calendarDate === getTodayIST()
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border bg-card hover:bg-muted text-foreground'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleNextCalendarDay}
                  className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium transition-all"
                >
                  Next day
                </button>
                <input
                  type="date"
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                  className="p-2 rounded-xl border border-border bg-background text-foreground text-xs font-normal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mini Month Grid Picker Sidebar */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-normal text-foreground">
                    {getMonthDatesWithCounts().monthName}
                  </h3>
                  <span className="text-xs font-normal text-muted-foreground">Select date</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs font-normal text-muted-foreground mb-1">
                  <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {getMonthDatesWithCounts().days.map((item, idx) => {
                    if (!item) {
                      return <div key={`empty-${idx}`} className="h-8" />;
                    }
                    return (
                      <button
                        key={item.dateFormatted}
                        type="button"
                        onClick={() => setCalendarDate(item.dateFormatted)}
                        className={`h-8 rounded-lg flex flex-col items-center justify-center relative text-xs font-normal transition-all ${
                          item.isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : item.isToday
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <span>{item.day}</span>
                        {item.count > 0 && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                              item.isSelected ? 'bg-primary-foreground' : 'bg-primary'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Hourly Timeline Grid */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-normal text-foreground">
                    Day schedule timeline
                  </h3>
                  <span className="text-xs text-muted-foreground">07:00 AM – 10:00 PM</span>
                </div>

                {getCalendarDateAppointments(calendarDate).length === 0 ? (
                  <div className="p-10 text-center space-y-2 bg-muted/20 rounded-xl border border-dashed border-border">
                    <h4 className="text-sm font-medium text-foreground">No sessions scheduled</h4>
                    <p className="text-xs text-muted-foreground">
                      No client appointments are scheduled for {calendarDate === getTodayIST() ? 'today' : calendarDate}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 divide-y divide-border/40">
                    {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((hour) => {
                      const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
                      const hourApts = getCalendarDateAppointments(calendarDate).filter((apt) => {
                        const startD = new Date(apt.start_time);
                        return !isNaN(startD.getTime()) && startD.getHours() === hour;
                      });

                      return (
                        <div key={hour} className="pt-3 flex gap-4 text-xs items-start">
                          <div className="w-20 font-mono text-xs font-normal text-muted-foreground pt-1">
                            {hourLabel}
                          </div>
                          <div className="flex-1 space-y-2">
                            {hourApts.length === 0 ? (
                              <div className="h-6 border-b border-dotted border-border/30" />
                            ) : (
                              hourApts.map((apt) => {
                                const patient = apt.profiles || {};
                                const isComp = isAppointmentCompleted(apt);
                                const statusLabel = isComp ? 'completed' : apt.status;

                                return (
                                  <div
                                    key={apt.id}
                                    className="p-4 rounded-xl border border-border bg-card space-y-3"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground text-sm">
                                          {patient.name || 'Client session'}
                                        </span>
                                        {apt.session_number && (
                                          <span className="px-2 py-0.5 rounded-md text-xs font-normal bg-muted text-muted-foreground border border-border">
                                            Session {apt.session_number}
                                          </span>
                                        )}
                                      </div>

                                      <span className="text-xs font-normal font-mono text-muted-foreground">
                                        {formatDateTime(apt.start_time)}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleJoinMeeting(apt.id)}
                                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-sm transition-all"
                                      >
                                        <span>Launch Google Meet</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'availability' ? (
          /* ── AVAILABILITY TAB VIEW ── */
          <div className="space-y-6 animate-fade-in font-sans">
            <div className="flex items-center gap-4 border-b border-border/60 pb-px text-xs">
              {[
                { id: 'working_hours', label: 'General working times' },
                { id: 'specific_dates', label: 'Specific date unavailability' },
              ].map((subTab) => (
                <button
                  key={subTab.id}
                  type="button"
                  onClick={() => setAvailSubTab(subTab.id)}
                  className={`py-2 border-b-2 font-medium transition-all ${
                    availSubTab === subTab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {subTab.label}
                </button>
              ))}
            </div>

            {availSubTab === 'working_hours' ? (
              <form
                onSubmit={handleSaveWorkingHours}
                className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6"
              >
                <div>
                  <h2 className="text-xl font-normal text-foreground">General working times</h2>
                  <p className="text-xs text-muted-foreground mt-1">Set your weekly recurring practice hours.</p>
                </div>

                <div className="space-y-3">
                  {workingHoursSchedule.map((item) => (
                    <div key={item.dayOfWeek} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-muted/20 border border-border gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          onChange={() => handleDayToggle(item.dayOfWeek)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-foreground text-sm">{item.dayName}</span>
                      </div>

                      {item.isActive ? (
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(e) => handleDayTimeChange(item.dayOfWeek, 'startTime', e.target.value)}
                            className="p-1.5 rounded-lg border border-border bg-background text-foreground font-normal"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(e) => handleDayTimeChange(item.dayOfWeek, 'endTime', e.target.value)}
                            className="p-1.5 rounded-lg border border-border bg-background text-foreground font-normal"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unavailable</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={workingHoursSaving}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-sm transition-all"
                  >
                    {workingHoursSaving ? 'Saving...' : 'Save general working times'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <form onSubmit={handleAddTimeOff} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
                  <h2 className="text-xl font-normal">Set date unavailability</h2>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-normal mb-1 text-muted-foreground">Select date</label>
                      <input
                        type="date"
                        required
                        value={blockDate}
                        onChange={(e) => setBlockDate(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block font-normal mb-1 text-muted-foreground">Reason</label>
                      <input
                        type="text"
                        placeholder="Leave reason..."
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-border bg-background"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={timeOffSaving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-sm">
                    Block time
                  </button>
                </form>

                <div className="space-y-2">
                  {timeOffList.map((item) => {
                    const formatted = formatTimeOffPeriod(item.start_datetime, item.end_datetime);
                    return (
                      <div key={item.id} className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium block">{formatted.dateStr}</span>
                          <span className="text-muted-foreground">{formatted.timeRangeStr}</span>
                        </div>
                        <button type="button" onClick={() => handleDeleteTimeOff(item.id)} className="px-3 py-1 rounded-xl border border-border hover:bg-muted text-rose-600 font-medium">
                          Remove block
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 rounded-xl border border-border bg-card/60 animate-pulse h-24" />
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card p-12 text-center space-y-2">
            <h3 className="text-base font-normal">No appointments found</h3>
            <p className="text-xs text-muted-foreground">No appointments matched your current selection.</p>
          </div>
        ) : (
          /* ── STANDARD SESSIONS LIST ── */
          <div className="space-y-4 font-sans">
            {filteredAppointments.map((apt) => {
              const patient = apt.profiles || {};
              const isComp = isAppointmentCompleted(apt);
              const statusLabel = isComp ? 'completed' : apt.status;

              return (
                <div
                  key={apt.id}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-medium text-base">
                        {patient.name ? patient.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div>
                        <h3 className="text-base font-normal text-foreground">
                          {patient.name || 'Client practitioner session'}
                        </h3>
                        <p className="text-xs text-muted-foreground">{patient.email || 'Client'}</p>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-md text-xs font-normal border border-border capitalize bg-muted text-foreground">
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/30 border border-border text-xs">
                    <div>
                      <span className="text-[11px] font-normal text-muted-foreground block">Scheduled time</span>
                      <span className="font-semibold text-foreground mt-0.5 block">{formatDateTime(apt.start_time)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-normal text-muted-foreground block">Format & fee</span>
                      <span className="font-semibold text-foreground mt-0.5 block capitalize">{apt.session_type || 'Video'} ({formatINR(apt.fee_amount || 0)})</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-normal text-muted-foreground block">Ref code</span>
                      <span className="font-semibold font-mono text-foreground mt-0.5 block">{apt.appointment_number || apt.id}</span>
                    </div>
                  </div>

                  {/* Doctor Prescriptions & Remarks Callout */}
                  {(apt.clinical_notes || apt.doctor_remarks || apt.doctor_suggestions || apt.doctor_prescription) && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
                      <strong className="block font-medium">Doctor remarks & prescriptions:</strong>
                      {apt.clinical_notes && <p><strong>Remarks:</strong> {apt.clinical_notes}</p>}
                      {apt.doctor_suggestions && <p><strong>Suggestions:</strong> {apt.doctor_suggestions}</p>}
                      {apt.doctor_prescription && <p><strong>Prescription:</strong> {apt.doctor_prescription}</p>}
                    </div>
                  )}

                  {/* Therapist Action Toolbar */}
                  {apt.status !== 'cancelled' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotesAptId(apt.id);
                          setRemarksInputText(apt.clinical_notes || apt.doctor_remarks || '');
                          setSuggestionsInputText(apt.doctor_suggestions || '');
                          setPrescriptionInputText(apt.doctor_prescription || '');
                        }}
                        className="px-3.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition-all"
                      >
                        <span>Edit doctor remarks & prescriptions</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {apt.status === 'pending' && !isComp && (
                          <button
                            type="button"
                            disabled={actionLoadingId === apt.id}
                            onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-sm"
                          >
                            Confirm booking
                          </button>
                        )}

                        {apt.status === 'confirmed' && !isComp && (
                          <button
                            type="button"
                            disabled={actionLoadingId === apt.id}
                            onClick={() => openCompleteSessionModal(apt)}
                            className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs"
                          >
                            Mark as completed
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline Session Remarks & Prescription Editor */}
                  {editingNotesAptId === apt.id && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3 animate-fade-in">
                      <label className="block text-xs font-medium text-foreground">Doctor remarks, suggestions & prescription for {patient.name || 'Client'}:</label>
                      
                      <div>
                        <label className="block text-[11px] font-normal text-muted-foreground mb-1">Clinical session remarks / progress notes:</label>
                        <textarea
                          rows={2}
                          value={remarksInputText}
                          onChange={(e) => setRemarksInputText(e.target.value)}
                          placeholder="Enter clinical observations, assessment, and session remarks..."
                          className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-normal text-muted-foreground mb-1">Doctor suggestions & advice:</label>
                        <textarea
                          rows={2}
                          value={suggestionsInputText}
                          onChange={(e) => setSuggestionsInputText(e.target.value)}
                          placeholder="Enter advice, lifestyle changes, or homework assignments for client..."
                          className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-normal text-muted-foreground mb-1">Doctor prescription / recommended therapy plan:</label>
                        <textarea
                          rows={2}
                          value={prescriptionInputText}
                          onChange={(e) => setPrescriptionInputText(e.target.value)}
                          placeholder="Enter therapeutic prescription, exercises, or recommended care plan..."
                          className="w-full p-2.5 text-xs rounded-xl border border-border bg-background"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingNotesAptId(null)}
                          className="px-3.5 py-1.5 text-xs rounded-xl border border-border hover:bg-muted text-muted-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingNotesId === apt.id}
                          onClick={() => handleSaveDoctorNotesAndPrescription(apt.id)}
                          className="px-4 py-1.5 text-xs font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        >
                          {savingNotesId === apt.id ? 'Saving prescriptions...' : 'Save all prescriptions & remarks'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </main>

      {/* ── DEDICATED SESSION COMPLETION & REMARKS / PRESCRIPTION MODAL ── */}
      {completingSessionApt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleConfirmCompleteSession}
            className="bg-card border border-border/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xl">🩺</span>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Mark Session as Completed</h3>
                  <p className="text-xs text-muted-foreground">
                    Client: {completingSessionApt.profiles?.name || 'Client'} · {formatDateTime(completingSessionApt.start_time)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletingSessionApt(null)}
                className="w-8 h-8 rounded-full border border-border/60 hover:bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-extrabold text-foreground mb-1">
                  1. Clinical Session Remarks & Progress Notes:
                </label>
                <textarea
                  rows={3}
                  value={completingRemarksText}
                  onChange={(e) => setCompletingRemarksText(e.target.value)}
                  placeholder="Enter clinical observations, progress notes, and assessment..."
                  className="w-full p-3 rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block font-extrabold text-foreground mb-1">
                  2. Doctor Suggestions & Client Homework:
                </label>
                <textarea
                  rows={2}
                  value={completingSuggestionsText}
                  onChange={(e) => setCompletingSuggestionsText(e.target.value)}
                  placeholder="Enter lifestyle recommendations, exercises, or homework..."
                  className="w-full p-3 rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block font-extrabold text-foreground mb-1">
                  3. Doctor Prescription & Therapeutic Plan:
                </label>
                <textarea
                  rows={2}
                  value={completingPrescriptionText}
                  onChange={(e) => setCompletingPrescriptionText(e.target.value)}
                  placeholder="Enter therapeutic prescription, remedies, or ongoing care plan..."
                  className="w-full p-3 rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setCompletingSessionApt(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border/60 hover:bg-muted text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={completingSessionLoading}
                className="px-5 py-2 text-xs font-extrabold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-md transition-all active:scale-95"
              >
                {completingSessionLoading ? 'Saving...' : '✓ Save Notes & Complete Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancellingAptId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={handleCancelByTherapist}
            className="bg-card border border-border/80 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">Cancel Booking</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Please provide a cancellation reason. An automated email will be sent to notify the client.
              </p>
            </div>

            <textarea
              rows={3}
              required
              placeholder="e.g., Unforeseen emergency, please rebook for next week."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-3 text-xs rounded-2xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-rose-500/40"
            />

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingAptId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border/60 hover:bg-muted text-muted-foreground"
              >
                Keep Booking
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === cancellingAptId}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all"
              >
                {actionLoadingId === cancellingAptId ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingApt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-normal text-foreground">Reschedule Practitioner Session</h3>
              <button
                type="button"
                onClick={() => setReschedulingApt(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Client: <strong className="text-foreground">{reschedulingApt.profiles?.name || 'Client'}</strong></p>
              <p>Ref: <span className="font-mono">{reschedulingApt.appointment_number || reschedulingApt.id}</span></p>
              {reschedulingApt.session_number && (
                <p>Package Session #{reschedulingApt.session_number}</p>
              )}
            </div>

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                ⚠️ {rescheduleError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">New Date:</label>
                <input
                  type="date"
                  required
                  value={rescheduleDate}
                  min={getTodayIST()}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">New Start Time (IST):</label>
                <input
                  type="time"
                  required
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border/60 bg-background text-foreground focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setReschedulingApt(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-border/60 hover:bg-muted text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleLoading}
                  className="px-5 py-2 text-xs font-extrabold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all"
                >
                  {rescheduleLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
