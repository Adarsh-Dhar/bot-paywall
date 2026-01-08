import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-encryption";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const websiteUrl = searchParams.get("websiteUrl");
    const secretKey = searchParams.get("secretKey");

    if (!id && !websiteUrl && !secretKey) {
      return NextResponse.json({ success: false, error: "Project ID, websiteUrl, or secretKey is required" }, { status: 400 });
    }

    let project;

    if (id) {
      project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          websiteUrl: true,
          zoneId: true,
          secretKey: true,
          api_token: true,
        },
      });
    } else if (websiteUrl) {
      project = await prisma.project.findFirst({
        where: { websiteUrl },
        select: {
          id: true,
          websiteUrl: true,
          zoneId: true,
          secretKey: true,
          api_token: true,
        },
      });
    } else if (secretKey) {
      project = await prisma.project.findFirst({
        where: { secretKey },
        select: {
          id: true,
          websiteUrl: true,
          zoneId: true,
          secretKey: true,
          api_token: true,
        },
      });
    }

    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    // Decrypt api_token if it exists
    let decryptedToken: string | null = null;
    if (project.api_token) {
      try {
        decryptedToken = decryptToken(project.api_token);
      } catch (error) {
        console.warn('Token decryption failed, using as-is:', error);
        decryptedToken = project.api_token;
      }
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        websiteUrl: project.websiteUrl,
        zoneId: project.zoneId,
        secretKey: project.secretKey,
        api_token: decryptedToken,
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
