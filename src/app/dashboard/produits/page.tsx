import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export default function ProduitsPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <Tabs defaultValue="stocks" className="flex h-full flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
          <TabsTrigger value="prix">Prix & Marges</TabsTrigger>
          <TabsTrigger value="perf">Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="stocks" className="mt-4 flex-1">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">
            Tableau stocks par marché — brancher sur <code className="text-foreground">produits</code> (Supabase).
          </Card>
        </TabsContent>
        <TabsContent value="prix" className="mt-4">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">
            Prix référence = plus bas des réductions — édition live (coût, prix, remises).
          </Card>
        </TabsContent>
        <TabsContent value="perf" className="mt-4">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">Classement marge brute.</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
