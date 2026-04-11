import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export default function MembresPage() {
  return (
    <div className="h-full overflow-y-auto px-5 py-4">
      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="acces">Accès & Connexion</TabsTrigger>
          <TabsTrigger value="rh">Contrat & RH</TabsTrigger>
          <TabsTrigger value="pres">Présences</TabsTrigger>
        </TabsList>
        <TabsContent value="profil" className="mt-4">
          <Card className="border-border/80 p-4 text-sm text-muted-foreground">Table `membres`.</Card>
        </TabsContent>
        <TabsContent value="acces" className="mt-4">
          <Card className="border-border/80 p-4 text-sm">Code temporaire + permissions JSON.</Card>
        </TabsContent>
        <TabsContent value="rh" className="mt-4">
          <Card className="border-border/80 p-4 text-sm">CDI/CDD/Stage/Prestataire.</Card>
        </TabsContent>
        <TabsContent value="pres" className="mt-4">
          <Card className="border-border/80 p-4 text-sm">Calendrier présences.</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
