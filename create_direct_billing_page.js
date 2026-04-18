const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'app/pharmacy/billing/[visitId]/page.tsx');
const destDir = path.join(__dirname, 'app/pharmacy/billing/direct/[patientId]');
const destPath = path.join(destDir, 'page.tsx');

let content = fs.readFileSync(srcPath, 'utf8');

content = content.replace(/VisitMedicineBillingPage/g, 'DirectMedicineBillingPage');

content = content.replace(/useParams<\s*\{\s*visitId:\s*string\s*\}\s*>\(\)/g, 'useParams<{ patientId: string }>()');
content = content.replace(/const visitId = params\?\.visitId \?\? "";/g, 'const patientId = params?.patientId ?? "";');

content = content.replace(/const \[visit, setVisit\] = useState<Visit \| null>\(null\);/g, 'const [patient, setPatient] = useState<Patient | null>(null);');
content = content.replace(/!visitId/g, '!patientId');
content = content.replace(/\[hydrateStoredBillItems, visitId\]\);/g, '[hydrateStoredBillItems, patientId]);');

content = content.replace(
  /fetch\(`\/api\/visits\/\$\{visitId\}`.*?\n\s+fetch\("\/api\/medicines".*?\n\s+\]\)/s,
  `fetch(\`/api/patients/\${patientId}\`, { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/medicines", { cache: "no-store" }).then((res) => res.json()),
    ])`
);

content = content.replace(
  /setMedicineOptions\(Array\.isArray\(medicineList\) \? medicineList : \[\]\);\s+if \(!visitData\?._id \|\| !visitData\?\.patient\?._id\) \{\s+throw new Error\("Visit not found"\);\s+\}\s+setVisit\(visitData as Visit\);\s+const existingBillId = Array\.isArray\(visitData\.medicineBills\) && visitData\.medicineBills\.length > 0\s+\? visitData\.medicineBills\[0\]\?\._id\s+: undefined;/s,
  `setMedicineOptions(Array.isArray(medicineList) ? medicineList : []);
        if (!visitData?._id) {
          throw new Error("Patient not found");
        }
        setPatient(visitData as unknown as Patient);
        const existingBillId = Array.isArray(visitData.medicineBills) && visitData.medicineBills.length > 0
          ? visitData.medicineBills[0]?._id
          : undefined;`
);

content = content.replace(
  /return fetch\([\s\S]*?then\(async \(pres\) => \{[\s\S]*?setItems\(\(prev\) => \(prev\.length > 0 \? prev : rows\)\);\s+\}\)/g,
  `setPrescription(null);\n      })`
);

content = content.replace(
  /catch \(\(e\)\) \{[\s\S]*?setVisit\(null\);[\s\S]*?setPrescription\(null\);[\s\S]*?setItems\(\[\]\);[\s\S]*?toast\.error\(e instanceof Error \? e\.message : "Failed to load visit"\);/g,
  `catch ((e)) {
        setPatient(null);
        setPrescription(null);
        setItems([]);
        toast.error(e instanceof Error ? e.message : "Failed to load patient");`
);

content = content.replace(
  /if \(!visit\?\.patient\?\._id \|\| !visit\?\._id \|\| billableItems\.length === 0\) \{[\s\S]*?toast\.error\("Visit details missing"\);\s+\}\s+return;\s+\}/g,
  `if (!patient?._id || billableItems.length === 0) {
      toast.error("No billable medicines found");
      return;
    }`
);

content = content.replace(/patientId: visit\.patient\._id,\s+visitId: visit\._id,/g, `patientId: patient._id,`);

content = content.replace(/<h1 className="text-2xl font-semibold">Visit Billing Details<\/h1>/g, '<h1 className="text-2xl font-semibold">Direct Billing Details</h1>');
content = content.replace(/\(bill\.patient as Patient\)/g, '(bill.patient as unknown as Patient)');
content = content.replace(
  /visit\?\.doctor\?\.name\?\.trim\(\)\s+\? visit\.doctor\.name\s+: prescription\?\.doctor\?\.name\?\.trim\(\)\s+\? prescription\.doctor\.name\s+: "—"/s,
  `"—"`
);

content = content.replace(/visit\?\.visitDate/g, 'patient?.createdAt');
content = content.replace(/visit\.visitDate/g, 'patient.createdAt');
content = content.replace(/!visit \?/g, '!patient ?');
content = content.replace(/>Visit not found\.</g, '>Patient not found.<');

content = content.replace(
  /<CardTitle>Visit<\/CardTitle>\s*<CardDescription>Billing is locked to this visit only<\/CardDescription>\s*<\/CardHeader>\s*<CardContent className="text-sm">\s*<p>\s*<strong>Patient:<\/strong> \{visit\.patient\?\.name\} \(\{visit\.patient\?\.regNo\}\)\s*<\/p>\s*<p>\s*<strong>Receipt:<\/strong> \{visit\.receiptNo \?\? "-"\} \| <strong>Time:<\/strong>\{" "\}\s*\{format\(new Date\(patient\.createdAt\), "dd MMM yyyy, HH:mm"\)\}\s*<\/p>\s*<\/CardContent>/gs,
  `<CardTitle>Patient Details</CardTitle>
              <CardDescription>Direct pharmacy purchase</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <strong>Patient:</strong> {patient.name} ({patient.regNo})
              </p>
              <p>
                <strong>Registered:</strong>{" "}
                {patient.createdAt ? format(new Date(patient.createdAt), "dd MMM yyyy, HH:mm") : "-"}
              </p>
            </CardContent>`
);

content = content.replace(/Prescription Medicines/g, "Medicines");
content = content.replace(/\{prescription\?\.doctor\?\.name[\s\S]*?"Search the catalog to add medicines; adjust batches before billing\."\}/s, `{"Search the catalog to add medicines; adjust batches before billing."}`);
content = content.replace(/\{!prescription && \([\s\S]*?No prescription found for this visit\. You can add medicines manually\.<\/p>\s*\)\}/s, "");
content = content.replace(/No medicines in prescription\./g, "No medicines added yet.");

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(destPath, content, 'utf8');
console.log('Direct billing page regenerated.');
