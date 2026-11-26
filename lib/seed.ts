import type { CampusDbState } from "@/types/campus";

export function createSeedData(): CampusDbState {
  return {
    notices: [
      {
        id: "notice-exam-2026-088",
        circular_no: "EXAM/2026/088",
        title: "Original B.Tech Semester 3 Mid-Semester Examination Schedule",
        summary:
          "Initial notification announcing B.Tech Sem 3 Mid-Sem examinations starting 28 November 2026 across all branches. This circular has been superseded by EXAM/2026/104.",
        extracted_text:
          "OFFICE OF THE CONTROLLER OF EXAMINATIONS\nCircular No: EXAM/2026/088 | Date: 10 Nov 2026\nSubject: B.Tech Semester 3 Mid-Semester Examination Schedule (Original)\n1. All B.Tech Semester 3 students (CSE, AIML, ECE, ME) are informed that Mid-Semester Examinations are scheduled to commence from 28 Nov 2026 in Morning Shift (10:00 AM - 11:30 AM).\n2. Detailed room allotment will be notified separately by respective departments.",
        page_references: [
          {
            page: 1,
            excerpt:
              "All B.Tech Semester 3 students (CSE, AIML, ECE, ME) are informed that Mid-Semester Examinations are scheduled to commence from 28 Nov 2026 in Morning Shift (10:00 AM - 11:30 AM).",
          },
        ],
        topic_tag: "midsem_schedule",
        effective_date: "2026-11-10",
        status: "superseded",
        superseded_by_id: "notice-exam-2026-104",
        target_branches: ["All"],
        target_semesters: [3],
        audience_type: "all",
        policy_rules: null,
        file_name: "EXAM_2026_088_MidSem_Original.pdf",
        file_mime: "application/pdf",
        created_at: "2026-11-10T10:15:00.000Z",
      },
      {
        id: "notice-exam-2026-104",
        circular_no: "EXAM/2026/104",
        title: "Revised B.Tech Semester 3 Mid-Semester Examination Schedule",
        summary:
          "Supersedes EXAM/2026/088. B.Tech Sem 3 Mid-Sem exams are postponed from 28 Nov to 04 Dec 2026. Reporting time is 9:30 AM and University ID card is mandatory (no entry after 9:45 AM).",
        extracted_text:
          "OFFICE OF THE CONTROLLER OF EXAMINATIONS\nCircular No: EXAM/2026/104 | Date: 22 Nov 2026\nSubject: REVISED B.Tech Semester 3 Mid-Semester Examination Schedule (Supersedes EXAM/2026/088)\n1. Due to inter-university technical fest logistics, the B.Tech Semester 3 Mid-Semester Examinations originally scheduled from 28 Nov 2026 (vide EXAM/2026/088) are hereby shifted and will now commence from 04 Dec 2026.\n2. Reporting Time: 9:30 AM sharp at Examination Block A & B. Gates close at 9:45 AM; strictly no entry after 9:45 AM.\n3. Valid University ID card and stamped Admit Card are mandatory for entry.",
        page_references: [
          {
            page: 1,
            excerpt:
              "The B.Tech Semester 3 Mid-Semester Examinations originally scheduled from 28 Nov 2026 (vide EXAM/2026/088) are hereby shifted and will now commence from 04 Dec 2026.",
          },
          {
            page: 1,
            excerpt:
              "Reporting Time: 9:30 AM sharp at Examination Block A & B. Gates close at 9:45 AM; strictly no entry after 9:45 AM. Valid University ID card and stamped Admit Card are mandatory for entry.",
          },
        ],
        topic_tag: "midsem_schedule",
        effective_date: "2026-11-22",
        status: "active",
        superseded_by_id: null,
        target_branches: ["All"],
        target_semesters: [3],
        audience_type: "all",
        policy_rules: null,
        file_name: "EXAM_2026_104_MidSem_Revised.pdf",
        file_mime: "application/pdf",
        created_at: "2026-11-22T09:30:00.000Z",
      },
      {
        id: "notice-fee-2026-051",
        circular_no: "FEE/2026/051",
        title: "End-Semester Examination Form & Fee Submission Notice",
        summary:
          "Mandatory End-Sem exam form verification and fee payment due by 29 Nov 2026 (11:59 PM) for all B.Tech branches and semesters. Late fine of ₹500/day applies strictly from 30 Nov.",
        extracted_text:
          "ACCOUNTS & EXAMINATION CELL\nCircular No: FEE/2026/051 | Date: 18 Nov 2026\nSubject: End-Semester Examination Form & Fee Submission (Odd Sem 2026)\n1. All regular and backlog students across all branches and semesters (Sem 1-8) must complete End-Sem Examination Form submission and online fee payment on the University ERP portal on or before 29 Nov 2026 (11:59 PM).\n2. Penalty Clause: Submissions after 29 Nov 2026 will attract a mandatory late fine of ₹500/day without exception.\n3. Hostel residents must clear mess dues prior to ERP form lock; Day Scholars may verify directly via Academic Cell.",
        page_references: [
          {
            page: 1,
            excerpt:
              "All regular and backlog students across all branches and semesters (Sem 1-8) must complete End-Sem Examination Form submission and online fee payment on the University ERP portal on or before 29 Nov 2026 (11:59 PM).",
          },
          {
            page: 1,
            excerpt:
              "Penalty Clause: Submissions after 29 Nov 2026 will attract a mandatory late fine of ₹500/day without exception.",
          },
        ],
        topic_tag: "fee_deadline",
        effective_date: "2026-11-18",
        status: "active",
        superseded_by_id: null,
        target_branches: ["All"],
        target_semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        audience_type: "all",
        policy_rules: null,
        file_name: "FEE_2026_051_Exam_Fee_Circular.pdf",
        file_mime: "application/pdf",
        created_at: "2026-11-18T11:00:00.000Z",
      },
      {
        id: "notice-cse-2026-072",
        circular_no: "CSE/2026/072",
        title: "DBMS & Python Lab Practical File Submission Guidelines",
        summary:
          "CSE and AIML Semester 3 students must submit hardbound DBMS & Python Lab practical files by 02 Dec 2026 at 4:00 PM in Lab 304. Failure results in 0 internal lab marks.",
        extracted_text:
          "DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING\nCircular No: CSE/2026/072 | Date: 20 Nov 2026\nSubject: Final Submission of DBMS & Python Lab Practical Files (Sem 3 - CSE & AIML)\n1. All B.Tech Semester 3 students of CSE and AIML are instructed to submit their spiral-bound DBMS (CS-302L) and Python Programming (CS-304L) practical records duly signed by faculty mentors.\n2. Final Deadline: 02 Dec 2026, 4:00 PM at Lab 304 (Academic Block II).\n3. Consequence: Late or incomplete submissions will not be evaluated and will be awarded 0 internal lab marks.",
        page_references: [
          {
            page: 1,
            excerpt:
              "All B.Tech Semester 3 students of CSE and AIML are instructed to submit their spiral-bound DBMS (CS-302L) and Python Programming (CS-304L) practical records duly signed by faculty mentors. Final Deadline: 02 Dec 2026, 4:00 PM at Lab 304.",
          },
          {
            page: 1,
            excerpt:
              "Consequence: Late or incomplete submissions will not be evaluated and will be awarded 0 internal lab marks.",
          },
        ],
        topic_tag: "lab_submission",
        effective_date: "2026-11-20",
        status: "active",
        superseded_by_id: null,
        target_branches: ["CSE", "AIML"],
        target_semesters: [3],
        audience_type: "all",
        policy_rules: null,
        file_name: "CSE_2026_072_Lab_Submission.pdf",
        file_mime: "application/pdf",
        created_at: "2026-11-20T14:20:00.000Z",
      },
      {
        id: "notice-acad-2026-041",
        circular_no: "ACAD/2026/041",
        title: "Academic Ordinance: Attendance & Medical Leave Relaxation",
        summary:
          "Minimum 75% attendance is mandatory across all courses. Under Clause 4.2, medical relaxation down to 65% is permitted if a registered doctor's certificate is submitted to the HOD within 5 working days.",
        extracted_text:
          "DEAN OF ACADEMIC AFFAIRS\nCircular No: ACAD/2026/041 | Date: 15 Aug 2026\nSubject: University Attendance & Medical Leave Ordinance (AY 2026-27)\nClause 4.1 (Standard Requirement): Every student across all branches and semesters must maintain a minimum of 75% attendance in lectures, tutorials, and practicals to remain eligible for End-Semester Examinations.\nClause 4.2 (Medical Relaxation Zone): Students whose aggregate attendance falls between 65% and 74.9% strictly due to hospitalization or documented medical illness may apply for condonation to the Head of Department (HOD).\nClause 4.3 (Submission Protocol): Application along with original medical certificate from a registered medical practitioner (with MCI/NMC registration number), diagnostic reports, and prescription must be submitted to the HOD office within 5 working days of resuming classes.\nClause 4.4: Below 65% attendance results in automatic academic detention regardless of medical grounds.",
        page_references: [
          {
            page: 1,
            excerpt:
              "Clause 4.1: Every student across all branches and semesters must maintain a minimum of 75% attendance in lectures, tutorials, and practicals to remain eligible for End-Semester Examinations.",
          },
          {
            page: 2,
            excerpt:
              "Clause 4.2: Students whose aggregate attendance falls between 65% and 74.9% strictly due to hospitalization or documented medical illness may apply for condonation to the Head of Department (HOD). Clause 4.3: Application along with original medical certificate from a registered medical practitioner must be submitted to the HOD office within 5 working days of resuming classes.",
          },
        ],
        topic_tag: "medical_leave",
        effective_date: "2026-08-15",
        status: "active",
        superseded_by_id: null,
        target_branches: ["All"],
        target_semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        audience_type: "all",
        policy_rules: {
          min_attendance: 75,
          medical_min: 65,
          clause: "4.2",
          submission_days: 5,
        },
        file_name: "ACAD_2026_041_Attendance_Ordinance.pdf",
        file_mime: "application/pdf",
        created_at: "2026-08-15T08:00:00.000Z",
      },
    ],
    deadlines: [
      {
        id: "deadline-exam-088",
        notice_id: "notice-exam-2026-088",
        circular_no: "EXAM/2026/088",
        title: "Sem 3 Mid-Sem Exams Begin (Original Date)",
        due_date: "2026-11-28",
        due_time: "10:00 AM",
        penalty_impact: "Superseded by EXAM/2026/104",
        urgency: "normal",
        action_url: null,
        target_branches: ["All"],
        target_semesters: [3],
        audience_type: "all",
        status: "superseded",
        completed: false,
      },
      {
        id: "deadline-fee-051",
        notice_id: "notice-fee-2026-051",
        circular_no: "FEE/2026/051",
        title: "End-Sem Exam Form & Fee Submission",
        due_date: "2026-11-29",
        due_time: "11:59 PM",
        penalty_impact: "₹500/day late fine after 29 Nov",
        urgency: "critical",
        action_url: "https://erp.askcampus.edu.in/exam-form",
        target_branches: ["All"],
        target_semesters: [1, 2, 3, 4, 5, 6, 7, 8],
        audience_type: "all",
        status: "active",
        completed: false,
      },
      {
        id: "deadline-cse-072",
        notice_id: "notice-cse-2026-072",
        circular_no: "CSE/2026/072",
        title: "DBMS & Python Lab Practical File Submission",
        due_date: "2026-12-02",
        due_time: "04:00 PM",
        penalty_impact: "0 internal lab marks if missed",
        urgency: "high",
        action_url: null,
        target_branches: ["CSE", "AIML"],
        target_semesters: [3],
        audience_type: "all",
        status: "active",
        completed: false,
      },
      {
        id: "deadline-exam-104",
        notice_id: "notice-exam-2026-104",
        circular_no: "EXAM/2026/104",
        title: "Revised B.Tech Sem 3 Mid-Sem Exams Begin",
        due_date: "2026-12-04",
        due_time: "09:30 AM",
        penalty_impact: "No entry after 9:45 AM",
        urgency: "high",
        action_url: null,
        target_branches: ["All"],
        target_semesters: [3],
        audience_type: "all",
        status: "active",
        completed: false,
      },
    ],
    alert_logs: [
      {
        id: "alert-001",
        notice_id: "notice-exam-2026-104",
        circular_no: "EXAM/2026/104",
        channel: "in_app",
        message:
          "Conflict resolved: EXAM/2026/104 superseded EXAM/2026/088. Sem 3 Mid-Sem shifted from 28 Nov to 04 Dec 2026 (9:30 AM reporting).",
        sent_at: "2026-11-22T09:30:10.000Z",
      },
      {
        id: "alert-002",
        notice_id: "notice-cse-2026-072",
        circular_no: "CSE/2026/072",
        channel: "in_app",
        message:
          "Deadline radar updated for CSE & AIML Sem 3: DBMS & Python Lab Practical File due 02 Dec 2026 at 4:00 PM (Lab 304).",
        sent_at: "2026-11-20T14:21:00.000Z",
      },
      {
        id: "alert-003",
        notice_id: "notice-fee-2026-051",
        circular_no: "FEE/2026/051",
        channel: "in_app",
        message:
          "Critical fine alert: End-Sem Exam Form & Fee due 29 Nov 2026 (11:59 PM). ₹500/day late fine applies thereafter.",
        sent_at: "2026-11-18T11:02:00.000Z",
      },
    ],
  };
}
