# 4. Feature Requirements & User Stories

## 4.1. ESR Initiation and Assignment

> **User Story:** As a Requestor, I need to submit an ESR with a JCN so that engineering can be formally alerted and assigned to my deckplate issue.

**Requirements:**

- The workflow begins when an “ESR Required” condition is met on the shop floor.
- The Requestor submits the initial ESR form. The record enters “Unassigned” status.
- The system prompts the user for a JCN, automatically pulling in the corresponding LDS data (Work statement, Refit, Component/TSN, and Location). A JCN is not required, a user can select N/A as an option.
- The user inputs required fields: Name, shop, phone #, References and Condition/ finding
- The user can attach images and documents as necessary to References and Conditions.
- The Engineering Supervisor reviews the incoming request and can assign a primary Engineer, reject the ESR with comment back to the shop, or delete the ESR altogether.
- Upon assignment, the system generates a unique ESR Serial Number and updates the status to “In Process”. The ESR serial number format will be `esrId = <two-digit-year><0001-9999><A-ZZ>`.

## 4.2. Resolution

Once assigned, the Engineer must choose a path to construct the technical resolution and rationale.

### 4.2.1. Path A: AI-Assisted Resolution

> **User Story:** As an Engineer, I want to use AI assistance to summarize the reported problem and search for historical precedents so that I can draft an accurate resolution based on proven solutions.

**Requirements:**

- There is button that allows the user to summarize and search for similar resolved ESRs
- the system triggers the semantic search engine using the active ESR’s raw condition description.
- The system generates a concise, conceptual summary of the issue using Generative AI.
- The system displays the top matching historical, resolved ESRs with a similarity rating.
- The Engineer can select a historical match and copy its resolution and rational text to the clipboard and paste it into the active ESR Resolution and rationale.

### 4.2.2. Path B: Manual Resolution (Standard)

> **User Story:** As an Engineer, I want to write the technical resolution and rationale manually so that I can document unique or proprietary engineering procedures.

**Requirements:**

- If AI is not utilized, the user will open new ESR record and start to draft the resolution and rationale.
- The Engineer manually inputs the technical resolution and the engineering rationale.

## 4.3. Formatting, Templates, and File Attachments

> **User Story:** As an Engineer, I need to apply standardized templates and upload supporting technical drawings or deckplate photos to my draft so that the instructions for the shop are complete and visual.

**Requirements:**

Regardless of the generation path (AI or Manual), the Engineer must have access to:

- An Engineering Template Library to quickly insert boilerplate procedures and documents.
- A File Attachment Module to upload and link relevant design drawings, sketches, or inspection images.

## 4.4. Attaching References & Attributes

> **User Story:** As an Engineer, I need to specify if Departure From Specification (DFS) or Technical Variance Documents (TVD) are required so that the ESR complies with formal naval specifications.

**Requirements:**

- The Engineer must answer two sequential system prompts: “DFS Required?” and “TVD Required?”.
- If Yes to either, the Engineer must input the specific reference or document number.
- The system automatically applies a visible metadata label to the ESR record in both the tabular workspace view and the final document header.
- The Engineer inputs any other applicable ESR Attributes before completing the draft (i.e Level 1, Requires Rev, SOC, SUBSAFE)

## 4.5. Digital Review and Approval

> **User Story:** As an Engineering Supervisor, I need to review the completed draft, technical references, and attachments so that I can digitally authorize the resolution to be issued.

**Requirements:**

- The Engineer digitally signs the “Resolved By” section, shifting the status to “Awaiting Approval”.
- The Supervisor reviews the draft, attachments, and referenced files.
- The Supervisor digitally signs the “Approved By” block, automatically changing the status to “ESR Issued”.
- The finalized ESR is locked from editing, compiled into a printable PDF, and made accessible to the Shop floor.
- Administrators shall be able to assign users the ability to sign both the engineer and engineering supervisor signature blocks with comment.
- Signatures must strictly match the identity provided in the active JSON Web Token
- Users shall be able to add comments to an ESR at every portion of the review process with each comment capturing the user who submitted and the time of the submission.

## 4.6. Shop Execution, Sign-off, and Closure

> **User Story:** As a Shop Representative, I need to execute the work, select our final completion status, and sign off so that the ESR is formally recorded.

**Requirements:**

- Shop Personnel perform the physical work defined in the issued ESR.
- A designated Shop user opens the digital record and fills out Block 25/26 (Name, Shop/Code, Date).
- The user must select one completion status: Completed, Deferred, Other or Canceled.
- If Canceled, Deferred, or “Other” is checked, Block 26 (Explanation) becomes a mandatory field.
- The Shop representative digitally signs the form, and the record is routed back to Engineering.
- The Division Head performs a final review of the shop's input (including acknowledging deferred statuses) and applies a final digital signature to close the record.
  - If deferred the ESR status will say “ESR Issued – Deferred”
  - If the Division Head concurs with the Closure of the ESR, The status transitions to “ESR Closed”, completing the workflow loop.

## 4.7. ESR Revisions

> **User Story:** As an Engineer, after an ESR has been issued, I may need to (a) Reflect actual installed configurations after completion of work. (b) Provide additional instruction, direction and information, or(c) Correct errors or omissions.

**Requirements:**

- After an ESR has been Issued, and there is a need for a change, the Engineer needs the ability to revise the original ESR
- The serial number gets updated at the end with a letter i.e. “A” (2 character max)
- The Engineer must add required revision information (including reason for revision) to the applicable ESR blocks or continuation sheet. The decision to retain information from a previous revision or replace the information is at the discretion of the applicable branch supervisor and is based on whether the previous information is relevant to completing the actions on the ESR.
- The Engineer will sign the “resolved by” section.
- The Engineering Supervisor will sign the “Approved By” section.
- The finalized ESR is locked from editing, compiled into a printable PDF, and made accessible to the Shop floor.
- Planners and Engineers need to be able to view historical revisions
