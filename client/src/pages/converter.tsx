import { useState, useEffect, useRef } from "react";
import { ToonConverter } from "@/lib/toon";
import { Button } from "@/components/ui/button";
import { 
  ArrowRightLeft, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  Code, 
  FileJson, 
  Settings2, 
  Download, 
  Copy,
  Check
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const PYTHON_CODE = `import json

class ToonConverter:
    def __init__(self):
        self.key_to_token = {}
        self.token_to_key = {}
        self.next_token_id = 1

    def get_token(self, key):
        if key in self.key_to_token:
            return self.key_to_token[key]
        
        token = f"{self.next_token_id:02d}"
        self.key_to_token[key] = token
        self.token_to_key[token] = key
        self.next_token_id += 1
        return token

    def get_key(self, token):
        return self.token_to_key.get(token, f"UNKNOWN_{token}")

    def json_to_toon(self, json_input):
        if isinstance(json_input, str):
            data = json.loads(json_input)
        else:
            data = json_input
            
        lines = []
        
        def process(item, level=0):
            indent = "  " * level
            
            if item is None:
                return "null"
            elif isinstance(item, bool):
                return "yes" if item else "no"
            elif isinstance(item, (int, float, str)):
                return str(item)
            elif isinstance(item, list):
                if not item:
                    return "[]"
                for sub_item in item:
                    if isinstance(sub_item, dict):
                        # Complex object in list
                        lines.append(f"{indent}-")
                        # Process children indented further? 
                        # Simplified approach for flat list of objects
                        for k, v in sub_item.items():
                            token = self.get_token(k)
                            is_complex = isinstance(v, (dict, list))
                            prefix = f"{indent}  {token}:"
                            if is_complex:
                                lines.append(prefix)
                                process(v, level + 2)
                            else:
                                lines.append(f"{prefix} {process(v, 0)}")
                    else:
                        lines.append(f"{indent}- {process(sub_item, 0)}")
                return ""
            elif isinstance(item, dict):
                if not item:
                    return "{}"
                for k, v in item.items():
                    token = self.get_token(k)
                    is_complex = isinstance(v, (dict, list))
                    prefix = f"{indent}{token}:"
                    if is_complex:
                        lines.append(prefix)
                        process(v, level + 1)
                    else:
                        lines.append(f"{prefix} {process(v, 0)}")
                return ""
        
        result = process(data)
        if result: # If root is primitive
            return result
        return "\\n".join(lines)

    def toon_to_json(self, toon_string):
        # Basic parser implementation would go here
        # (Simplified for brevity in this view)
        pass

# Example Usage
converter = ToonConverter()
json_data = '{"name": "Goku", "level": 9000, "isSuperSaiyan": true}'
toon_output = converter.json_to_toon(json_data)
print(toon_output)
`;

const EXAMPLE_JSON = JSON.stringify({
  "name": "Goku",
  "powerLevel": 9001,
  "isSuperSaiyan": true,
  "techniques": ["Kamehameha", "Spirit Bomb"],
  "stats": {
    "strength": 100,
    "speed": 95
  }
}, null, 2);

export default function ConverterPage() {
  const [jsonInput, setJsonInput] = useState(EXAMPLE_JSON);
  const [toonInput, setToonInput] = useState("");
  const [converter] = useState(() => new ToonConverter());
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const updateMapping = () => {
    setMapping(converter.getMapping().keyToToken);
  };

  const handleJsonToToon = () => {
    try {
      setError(null);
      const result = converter.jsonToToon(jsonInput);
      setToonInput(result);
      updateMapping();
      toast({
        title: "Converted to TOON",
        description: "JSON successfully converted to TOON format.",
      });
    } catch (e: any) {
      setError(e.message);
      toast({
        variant: "destructive",
        title: "Conversion Failed",
        description: e.message,
      });
    }
  };

  const handleToonToJson = () => {
    try {
      setError(null);
      // Re-instantiate logic part if needed, but for now assuming one-way primarily for demo unless parsing implemented fully
      // The current TypeScript logic has a parser, let's try it
      const result = converter.toonToJson(toonInput);
      // Format JSON
      const formatted = JSON.stringify(JSON.parse(result), null, 2);
      setJsonInput(formatted);
      updateMapping();
       toast({
        title: "Converted to JSON",
        description: "TOON successfully converted back to JSON.",
      });
    } catch (e: any) {
      setError("Failed to parse TOON. Ensure format is correct.");
       toast({
        variant: "destructive",
        title: "Conversion Failed",
        description: "Failed to parse TOON. Ensure format is correct.",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
              T
            </div>
            <h1 className="font-semibold text-lg tracking-tight">JSON <ArrowRightLeft className="inline w-4 h-4 mx-1 text-muted-foreground"/> TOON Converter</h1>
          </div>
          
          <div className="flex items-center gap-2">
             <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Code className="w-4 h-4" />
                  View Python Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Python Implementation</DialogTitle>
                  <DialogDescription>
                    Copy this code to run the converter in your Python environment.
                  </DialogDescription>
                </DialogHeader>
                <div className="relative rounded-md border bg-muted p-4 overflow-hidden">
                    <ScrollArea className="h-[50vh] w-full rounded-md">
                        <pre className="text-sm font-mono text-foreground">
                            {PYTHON_CODE}
                        </pre>
                    </ScrollArea>
                    <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => copyToClipboard(PYTHON_CODE)}
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings2 className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Token Dictionary</SheetTitle>
                  <SheetDescription>
                    Mapping between JSON keys and TOON tokens.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <div className="rounded-md border border-border">
                    <div className="grid grid-cols-2 p-2 bg-muted font-medium text-xs uppercase tracking-wider border-b border-border">
                      <div>Key</div>
                      <div>Token</div>
                    </div>
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        {Object.entries(mapping).length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No tokens generated yet. Convert some JSON to populate.
                            </div>
                        ) : (
                            Object.entries(mapping).map(([key, token]) => (
                                <div key={key} className="grid grid-cols-2 p-2 border-b border-border/50 text-sm font-mono last:border-0 hover:bg-muted/50 transition-colors">
                                    <div className="truncate pr-2" title={key}>{key}</div>
                                    <div className="text-primary font-bold">{token}</div>
                                </div>
                            ))
                        )}
                    </ScrollArea>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Editor Area */}
      <main className="flex-1 container mx-auto p-4 h-[calc(100vh-64px)] flex flex-col md:flex-row gap-4">
        
        {/* JSON Panel */}
        <div className="flex-1 flex flex-col min-h-[300px] bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-accent" />
                    <span className="font-medium text-sm">JSON Input</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(jsonInput)}>
                        <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setJsonInput("")}>
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 relative">
                <textarea 
                    className="absolute inset-0 w-full h-full p-4 bg-transparent resize-none font-mono text-sm focus:outline-none text-foreground"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    spellCheck={false}
                    placeholder="// Paste your JSON here..."
                />
            </div>
        </div>

        {/* Actions Panel */}
        <div className="flex md:flex-col items-center justify-center gap-4 py-2 md:px-2">
            <Button 
                onClick={handleJsonToToon} 
                className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
            >
                <span className="md:hidden mr-2">Convert to TOON</span>
                <ArrowRight className="w-5 h-5" />
            </Button>
            
            <Button 
                onClick={handleToonToJson}
                variant="secondary"
                className="w-full md:w-auto"
            >
                <span className="md:hidden mr-2">Convert to JSON</span>
                <ArrowLeft className="w-5 h-5" />
            </Button>
        </div>

        {/* TOON Panel */}
        <div className="flex-1 flex flex-col min-h-[300px] bg-card rounded-lg border border-border overflow-hidden shadow-sm relative">
            <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-mono">TOON</Badge>
                    <span className="font-medium text-sm text-muted-foreground">Token Object Notation</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(toonInput)}>
                        <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setToonInput("")}>
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 relative">
                <textarea 
                    className="absolute inset-0 w-full h-full p-4 bg-transparent resize-none font-mono text-sm focus:outline-none text-foreground"
                    value={toonInput}
                    onChange={(e) => setToonInput(e.target.value)}
                    spellCheck={false}
                    placeholder="# TOON output will appear here..."
                />
            </div>
             {/* Decorative scanline effect */}
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_4px,6px_100%] z-10 opacity-20 mix-blend-overlay"></div>
        </div>

      </main>
    </div>
  );
}
