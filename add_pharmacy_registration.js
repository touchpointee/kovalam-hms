const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'app/pharmacy/billing/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add Dialog imports
const importRegex = /import \{ formatCurrency \} from "@\/lib\/utils";/;
const dialogImports = `import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";`;

content = content.replace(importRegex, `import { formatCurrency } from "@/lib/utils";\n${dialogImports}`);

// 2. Add form state and submit handler
const loadFnRegex = /const loadPharmacyOnlyPatients = \(\) => \{/;
const formLogic = `  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: "", phone: "", age: "" });

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone) {
      toast.error("Name and phone are required");
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPatient.name,
          phone: newPatient.phone,
          age: parseInt(newPatient.age, 10) || 0,
          gender: "other",
          registrationType: "pharmacy"
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to register patient");
      toast.success("Pharmacy patient registered");
      setIsRegisterOpen(false);
      setNewPatient({ name: "", phone: "", age: "" });
      loadPharmacyOnlyPatients();
    } catch (err: any) {
      toast.error(err.message || "Error registering patient");
    } finally {
      setRegistering(false);
    }
  };

  const loadPharmacyOnlyPatients = () => {`;

content = content.replace(loadFnRegex, formLogic);

// 3. Add the Dialog Trigger and Content
const headerRegex = /<CardTitle>Direct Purchases \(Pharmacy-only\)<\/CardTitle>\s*<CardDescription>\s*Patients who only want to purchase medicine over-the-counter without an OP visit\.\s*<\/CardDescription>/;

const newHeader = `<div className="flex items-center justify-between">
            <div>
              <CardTitle>Direct Purchases (Pharmacy-only)</CardTitle>
              <CardDescription>
                Patients who only want to purchase medicine over-the-counter without an OP visit.
              </CardDescription>
            </div>
            <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
              <DialogTrigger asChild>
                <Button variant="default">New Direct Patient</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register Direct Pharmacy Patient</DialogTitle>
                  <DialogDescription>
                    Enter basic details to create a direct billing profile.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegisterPatient} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Patient Name *</Label>
                    <Input
                      required
                      placeholder="e.g. John Doe"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      required
                      placeholder="10-digit number"
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Age (optional)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 30"
                      value={newPatient.age}
                      onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={registering}>
                      {registering ? "Registering..." : "Register"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>`;

content = content.replace(headerRegex, newHeader);

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Pharmacy page updated with registration dialog.');
