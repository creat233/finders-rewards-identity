import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormField } from "@/components/card-report/FormField";
import { LocationField } from "@/components/card-report/LocationField";
import PhotoUpload from "@/components/card-report/PhotoUpload";
import { ArrowLeft } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  documentType: z.string().min(1, "Le type de document est requis"),
  cardNumber: z.string()
    .min(1, "Le numéro du document est requis")
    .regex(/^\d+$/, "Le numéro du document doit contenir uniquement des chiffres"),
  location: z.string()
    .min(1, "Le lieu de découverte est requis"),
  foundDate: z.string()
    .min(1, "La date de découverte est requise"),
  description: z.string()
    .optional(),
});

const SignalerCarte = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const mounted = useRef(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentType: "id",
      cardNumber: "",
      location: "",
      foundDate: "",
      description: "",
    },
  });

  useEffect(() => {
    return () => {
      mounted.current = false;
      form.reset();
    };
  }, [form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!mounted.current) return;
    
    try {
      setIsSubmitting(true);
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Vous devez être connecté pour signaler un document",
        });
        return;
      }

      let photoUrl = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('card_photos')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('card_photos')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('reported_cards')
        .insert([
          {
            reporter_id: user.id,
            card_number: values.cardNumber,
            location: values.location,
            found_date: values.foundDate,
            description: values.description || null,
            photo_url: photoUrl,
            document_type: values.documentType,
          },
        ]);

      if (error) throw error;

      toast({
        title: "Signalement envoyé",
        description: "Votre signalement a été enregistré avec succès",
      });
      
      if (mounted.current) {
        navigate("/");
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi du signalement",
      });
    } finally {
      if (mounted.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleFileChange = (newFile: File | null) => {
    if (mounted.current) {
      setFile(newFile);
    }
  };

  if (!mounted.current) {
    return null;
  }

  return (
    <div className="container max-w-2xl py-10">
      <div className="flex items-center mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Signaler un document trouvé</h1>
          <p className="text-muted-foreground mt-2">
            Remplissez ce formulaire pour signaler un document d'identité que vous avez trouvé
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="documentType">Type de document</Label>
              <Select
                name="documentType"
                onValueChange={(value) => form.setValue("documentType", value)}
                defaultValue={form.getValues("documentType")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez le type de document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Carte d'identité</SelectItem>
                  <SelectItem value="driver">Permis de conduire</SelectItem>
                  <SelectItem value="passport">Passeport</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField
              control={form.control}
              name="cardNumber"
              label="Numéro du document"
              placeholder="Entrez le numéro du document"
            />

            <LocationField
              control={form.control}
              name="location"
              label="Lieu de découverte"
              placeholder="Où avez-vous trouvé le document ?"
            />

            <FormField
              control={form.control}
              name="foundDate"
              label="Date de découverte"
              type="date"
              placeholder="Quand avez-vous trouvé le document ?"
            />

            <FormField
              control={form.control}
              name="description"
              label="Description (facultatif)"
              placeholder="Ajoutez des détails supplémentaires"
              textarea
            />

            <PhotoUpload
              onFileChange={handleFileChange}
              currentFile={file}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Envoi en cours..." : "Envoyer le signalement"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default SignalerCarte;