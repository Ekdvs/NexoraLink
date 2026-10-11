import { errorResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { loginSchema, LoginSchema } from "@/lib/validation/auth.validation";
import bcrypt from "bcryptjs";
import { cookies } from "next/dist/server/request/cookies";
import { NextRequest } from "next/dist/server/web/spec-extension/request";


//login user
export const POST = async (request: NextRequest) => {
    try {

        let body: LoginSchema;
        try {
            body = await request.json();
        } catch {
            return errorResponse(
                "Invalid request body",
                null,
                400,
            );
        }

        // Validate the request body against the schema
        const validationResult = loginSchema.safeParse(body);

        if (!validationResult.success) {
            return errorResponse(
                "Invalid request body",
                validationResult.error,
                400,
            );
        }

        const { email, password } = validationResult.data;

        //finding user by email
        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true, emailVerified: true, status: true },
        });

        if (!user) {
            return errorResponse(
                "Invalid email or password",
                null,
                401,
            );
        }

        if (!user.emailVerified) {
            return errorResponse(
                "before logging in, please verify your email address. Check your inbox for the verification email.",
                null,
                401,
            );
        }

        if (user.status === "INACTIVE") {
            return errorResponse(
                "Your account is inactive. Please contact support for assistance.",
                null,
                403,
            );
        }

        // Check if the password is correct
        const isPasswordCorrect = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { passwordHash: true },
        });

        if (!isPasswordCorrect || !(await bcrypt.compare(password, isPasswordCorrect.passwordHash))) {
            return errorResponse(
                "Invalid email or password",
                null,
                401,
            );
        }

        // Generate access and refresh tokens
        const { generateAccessToken, generateRefreshToken } = await import("@/lib/jwt");
        const accessToken = generateAccessToken({ userId: user.id, email: email.trim().toLowerCase() });
        const refreshToken = generateRefreshToken({ userId: user.id });

        // Store the refresh token in the database
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken, loginAt: new Date() },
        });


        //add cookies to acess token and refresh token
        const cookieStore = await cookies();

        cookieStore.set("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 15,
        });

        cookieStore.set("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/api/auth",
            maxAge: 60 * 60 * 24 * 30,
        });

        const UserData = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true, name: true, status: true, emailVerified: true, createdAt: true, updatedAt: true },
        });

        return new Response(JSON.stringify({
            message: "Login successful",
            data: UserData,
        }), {
            status: 200,

        });


    }
    catch (error) {
        console.error("Error in login route:", error);
        return errorResponse(
            "An unexpected error occurred",
            null,
            500,
        );
    }

}