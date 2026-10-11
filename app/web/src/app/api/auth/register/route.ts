import { errorResponse, successResponse } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import { registerSchema, RegisterSchema } from "@/lib/validation/auth.validation";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Verification link validity
const VERIFICATION_TOKEN_TTL = 15 * 60 * 1000; // 15 minutes

//register new user
export const POST = async (request: NextRequest) => {
    try {
        let body: RegisterSchema;
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
        const validationResult = registerSchema.safeParse(body);

        if (!validationResult.success) {

            return errorResponse(
                "Invalid request body",
                validationResult.error,
                400,
            );
        }

        //add to data
        const { email, name, password } = validationResult.data;

        const normalizedEmail = email.trim().toLowerCase();

        //finding user by email
        const existingUser = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true, emailVerified: true },
        });

        if (existingUser) {
            return errorResponse(
                "User with this email already exists",
                null,
                409
            );
        }

        //hashing password
        const passwordHash = await bcrypt.hash(password, 12);

        //email verfication token generation
        const emailVerificationToken = crypto.randomBytes(32).toString("hex");

        const verificationTokenHash =
            crypto
                .createHash("sha256")
                .update(emailVerificationToken)
                .digest("hex");

        const expiresAt = new Date(
            Date.now() + VERIFICATION_TOKEN_TTL,
        );

        //creating new user
        const user = await prisma.$transaction(
            async (tx) => {
                const newUser = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        passwordHash,
                        name,
                        status: "INACTIVE",


                        emailVerified: false,
                    },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        createdAt: true,
                    },
                });

                await tx.emailVerificationToken.create({
                    data: {
                        tokenHash: verificationTokenHash,
                        userId: newUser.id,
                        expiresAt,
                    },
                });

                return newUser;
            },
        );

        const verificationUrl =
            `${process.env.NEXT_PUBLIC_APP_URL}` +
            `/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(user.email)}`;

        /*
         * TODO:
         *
         * await sendVerificationEmail({
         *   email: user.email,
         *   firstName: user.firstName,
         *   verificationUrl,
         * });
         */

        return successResponse(
            "Registration successful. Please check your email to verify your account.",
            {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    createdAt: user.createdAt,
                },
            },
            201,
        );


    }
    catch (error) {

        console.error("Error in register route:", error);
        return errorResponse(
            "An error occurred while processing the request.",
            error,
            500
        )
    }
}