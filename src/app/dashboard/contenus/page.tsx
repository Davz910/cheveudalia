import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export default function ContenusPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <Tabs defaultValue="cal" className="flex h-full flex-col">
        <TabsList className="mb-0 w-fit rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="cal"
            className="rounded-none border-b-2 border-transparent px-5 py-2.5 text-[13px] data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Calendrier éditorial
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="rounded-none border-b-2 border-transparent px-5 py-2.5 text-[13px] data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Médiathèque
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cal" className="mt-4 flex-1">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">
            Mini-calendrier + liste des posts — tables <code className="text-foreground">posts_cm</code> /{" "}
            <code className="text-foreground">medias</code>.
          </Card>
        </TabsContent>
        <TabsContent value="media" className="mt-4">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">
            Grille + upload Supabase Storage (description obligatoire), aperçu PDF/image.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
