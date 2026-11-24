import CustomTemplatePage from "./CustomTemplatePage";
import { redirect } from "next/navigation";
import { normalizePresentationGenerationMode } from "@/utils/presentationGenerationMode";
import { requireAdminSession } from "@/utils/serverAuth";

export const dynamic = "force-dynamic";

export default async function Page() {
    await requireAdminSession();

    if (
        normalizePresentationGenerationMode(
            process.env.PRESENTATION_GENERATION_MODE,
        ) === "smart"
    ) {
        redirect("/dashboard");
    }

    return <CustomTemplatePage />;
}
