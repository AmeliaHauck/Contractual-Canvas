// Prompt database grouped by drawing difficulty
const prompts = {
  easy: [
    {
      text: "Signature",
      drawerHint: "Draw a paper with a scribbly name being written.",
      guesserHints: ["This makes something official.", "Someone is writing their name to agree."]
    },
    {
      text: "Contract",
      drawerHint: "Draw a document titled \"Agreement\" with two signatures.",
      guesserHints: ["It involves rules and promises.", "A legal agreement between parties."]
    },
    {
      text: "Offer",
      drawerHint: "Draw one person handing a paper or box to another.",
      guesserHints: ["It comes before an agreement.", "Someone is proposing a deal."]
    },
    {
      text: "Acceptance",
      drawerHint: "Draw a big checkmark or thumbs-up next to a document.",
      guesserHints: ["This happens after an offer.", "Saying yes to a deal."]
    },
    {
      text: "Invoice",
      drawerHint: "Draw a bill with line items and a dollar sign.",
      guesserHints: ["You get this before you pay.", "It asks for money for work done."]
    },
    {
      text: "Payment",
      drawerHint: "Draw money being handed over.",
      guesserHints: ["This settles the bill.", "Money changes hands."]
    },
    {
      text: "Check",
      drawerHint: "Draw a check with a dollar amount and signature line.",
      guesserHints: ["It is a way to pay.", "Paper payment from a bank."]
    },
    {
      text: "Dollar Amount",
      drawerHint: "Draw a big dollar sign with numbers.",
      guesserHints: ["It relates to money.", "The total price or cost."]
    },
    {
      text: "Deliverable",
      drawerHint: "Draw a box labeled \"Finished Work.\"",
      guesserHints: ["This is what is promised.", "The item or work that must be provided."]
    },
    {
      text: "Deadline",
      drawerHint: "Draw a clock or calendar with alarm lines.",
      guesserHints: ["It involves time pressure.", "Last day something can be done."]
    },
    {
      text: "Calendar Date",
      drawerHint: "Draw a calendar page with a specific day circled.",
      guesserHints: ["It is time-related.", "A specific day on the calendar."]
    },
    {
      text: "Expiration",
      drawerHint: "Draw a calendar with an \"X\" or falling page.",
      guesserHints: ["Something stops being valid.", "The agreement ends on this date."]
    },
    {
      text: "Renewal",
      drawerHint: "Draw circular arrows around a contract.",
      guesserHints: ["It keeps something going.", "Extending an agreement."]
    },
    {
      text: "Termination",
      drawerHint: "Draw scissors cutting a document in half.",
      guesserHints: ["It stops something early.", "Ending the contract."]
    },
    {
      text: "Scissors",
      drawerHint: "Draw scissors cutting paper.",
      guesserHints: ["Think cancel or cut.", "Tool used to end or cut something."]
    },
    {
      text: "Negotiation",
      drawerHint: "Draw two people talking across a table.",
      guesserHints: ["It involves discussion.", "Both sides are trying to agree on terms."]
    },
    {
      text: "Meeting",
      drawerHint: "Draw several people around a table.",
      guesserHints: ["It involves people getting together.", "Formal discussion event."]
    },
    {
      text: "Handshake",
      drawerHint: "Draw two hands shaking.",
      guesserHints: ["It signals agreement.", "A deal is made."]
    },
    {
      text: "Scope of Work",
      drawerHint: "Draw a checklist labeled \"Work.\"",
      guesserHints: ["It defines boundaries.", "What tasks are included in the job."]
    },
    {
      text: "Checklist",
      drawerHint: "Draw a list with checkmarks.",
      guesserHints: ["It keeps track of tasks.", "A list to make sure nothing is missed."]
    },
    {
      text: "Inspection",
      drawerHint: "Draw a magnifying glass over a box or document.",
      guesserHints: ["Something is being checked.", "Reviewing work for approval."]
    },
    {
      text: "Box / Shipment",
      drawerHint: "Draw a box on a truck or with an arrow.",
      guesserHints: ["It is delivered.", "Physical goods being shipped."]
    },
    {
      text: "Milestone",
      drawerHint: "Draw a timeline with a flag.",
      guesserHints: ["A progress point.", "A major checkpoint in a project."]
    },
    {
      text: "Approval",
      drawerHint: "Draw a stamp or checkmark on a document.",
      guesserHints: ["Someone says yes officially.", "Formal permission given."]
    },
    {
      text: "Stamp",
      drawerHint: "Draw an ink stamp hitting paper.",
      guesserHints: ["It marks something official.", "Used to approve documents."]
    },
    {
      text: "Prime Contractor",
      drawerHint: "Draw a large person leading others.",
      guesserHints: ["The main party.", "The primary company responsible."]
    },
    {
      text: "Subcontractor",
      drawerHint: "Draw a smaller person working under a larger one.",
      guesserHints: ["Not the main party.", "Works for the prime contractor."]
    },
    {
      text: "Amendment",
      drawerHint: "Draw edits or changes on a contract.",
      guesserHints: ["Something was updated.", "A formal change to the contract."]
    },
    {
      text: "Exhibit",
      drawerHint: "Draw extra pages paper-clipped to a contract.",
      guesserHints: ["It supports the main document.", "An attachment to a contract."]
    },
    {
      text: "Signature Authority",
      drawerHint: "Draw a person with a stamp and pen.",
      guesserHints: ["Not everyone has this power.", "Permission to legally sign."]
    }
  ],
  medium: [
    {
      text: "Change Order",
      drawerHint: "Draw a checklist with an arrow pointing to a changed item.",
      guesserHints: ["Something was updated.", "The original plan was officially changed."]
    },
    {
      text: "Modification",
      drawerHint: "Draw a pencil editing a document.",
      guesserHints: ["Something did not stay the same.", "A contract detail was altered."]
    },
    {
      text: "Extension",
      drawerHint: "Draw a timeline that gets longer.",
      guesserHints: ["More time was added.", "The deadline was pushed out."]
    },
    {
      text: "Cost Estimate",
      drawerHint: "Draw a calculator and a dollar sign.",
      guesserHints: ["This is about predicting money.", "An educated guess of the total cost."]
    },
    {
      text: "Fixed Price",
      drawerHint: "Draw a dollar sign with a lock.",
      guesserHints: ["The amount will not change.", "One set price no matter what."]
    },
    {
      text: "Delay",
      drawerHint: "Draw an hourglass or clock with pause lines.",
      guesserHints: ["Something is late.", "The schedule slipped."]
    },
    {
      text: "Notice",
      drawerHint: "Draw an envelope sent to someone.",
      guesserHints: ["It is a formal message.", "Required written communication."]
    },
    {
      text: "Risk",
      drawerHint: "Draw a warning triangle or exclamation mark.",
      guesserHints: ["Something might go wrong.", "Potential harm or loss."]
    },
    {
      text: "Liability",
      drawerHint: "Draw a person carrying a heavy weight.",
      guesserHints: ["Someone is responsible.", "Legal responsibility if something goes wrong."]
    },
    {
      text: "Insurance",
      drawerHint: "Draw an umbrella over money or a house.",
      guesserHints: ["Protection against loss.", "Financial coverage for risk."]
    },
    {
      text: "Correction",
      drawerHint: "Draw an eraser fixing a mistake on paper.",
      guesserHints: ["A mistake was fixed.", "Making something right."]
    },
    {
      text: "Protection",
      drawerHint: "Draw a shield.",
      guesserHints: ["Keeps something safe.", "Prevents harm or loss."]
    },
    {
      text: "Confidentiality",
      drawerHint: "Draw a lock on a document or finger over lips.",
      guesserHints: ["Information is restricted.", "It must be kept secret."]
    },
    {
      text: "Approval Process",
      drawerHint: "Draw arrows moving between people.",
      guesserHints: ["It involves steps.", "The path to getting permission."]
    },
    {
      text: "Delivery",
      drawerHint: "Draw a truck with a box.",
      guesserHints: ["Something is being sent.", "Providing goods or services."]
    },
    {
      text: "Payment Schedule",
      drawerHint: "Draw a calendar with dollar signs on dates.",
      guesserHints: ["Money happens over time.", "Planned dates for payments."]
    }
  ],
  hard: [
    {
      text: "Waiver",
      drawerHint: "Draw a rule or document being waved away by a hand.",
      guesserHints: ["Someone is choosing not to use something.", "Giving up a right or requirement."]
    },
    {
      text: "Fairness",
      drawerHint: "Draw a balanced scale or two equal sides.",
      guesserHints: ["It involves equality.", "Being treated evenly."]
    },
    {
      text: "Good Faith",
      drawerHint: "Draw a smiling handshake or honest interaction.",
      guesserHints: ["It’s about intent.", "Acting honestly and sincerely."]
    },
    {
      text: "Effort",
      drawerHint: "Draw a person pushing something heavy or working hard.",
      guesserHints: ["It involves trying.", "How hard someone works."]
    },
    {
      text: "Time Period",
      drawerHint: "Draw a timeline with a clear start and end.",
      guesserHints: ["It deals with duration.", "A specific length of time."]
    },
    {
      text: "Major Breach",
      drawerHint: "Draw a contract with a big crack or tear.",
      guesserHints: ["A serious problem occurred.", "A severe violation of the agreement."]
    },
    {
      text: "Minor Breach",
      drawerHint: "Draw a contract with a small rip or scratch.",
      guesserHints: ["A problem, but not a big one.", "A small violation of the agreement."]
    },
    {
      text: "Damage Costs",
      drawerHint: "Draw a broken item next to dollar signs.",
      guesserHints: ["Money tied to harm.", "The cost of losses or damage."]
    },
    {
      text: "Price Adjustment",
      drawerHint: "Draw a dollar sign going up or down on a scale.",
      guesserHints: ["The cost changed.", "A revision to the original price."]
    },
    {
      text: "Dispute",
      drawerHint: "Draw two people arguing with speech bubbles.",
      guesserHints: ["There is disagreement.", "A conflict between parties."]
    },
    {
      text: "Resolution",
      drawerHint: "Draw a handshake after an argument.",
      guesserHints: ["The problem ends.", "The dispute is settled."]
    },
    {
      text: "Mediation",
      drawerHint: "Draw two people with a third person between them.",
      guesserHints: ["Help from someone else.", "A neutral person helps resolve a dispute."]
    },
    {
      text: "Re-Assignment",
      drawerHint: "Draw a document being handed from one person to another.",
      guesserHints: ["Responsibility changes hands.", "Work or duties move to someone else."]
    }
  ]
};

module.exports = prompts;
