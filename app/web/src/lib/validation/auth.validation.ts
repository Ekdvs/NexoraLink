import { z } from "zod";

//register schema
export const registerSchema = z.object(
    {
        email: z
            .string()
            .email("Invalid email address")
            .min(1, "Email is required")
            .trim()
            .toLowerCase()
            .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"),

        name: z
            .string()
            .min(2, "Name is required")
            .max(100, "Name must be less than 100 characters")
            .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces")
            .trim(),

        password: z
            .string()
            .min(12, "Password must be at least 12 characters")
            .max(128, "Password is too long")
            .refine(
                (password) => !/\s/.test(password),
                "Password must not contain spaces",
            )
            .refine(
                (password) => /[a-z]/.test(password),
                "Password must contain a lowercase letter",
            )
            .refine(
                (password) => /[A-Z]/.test(password),
                "Password must contain an uppercase letter",
            )
            .refine(
                (password) => /\d/.test(password),
                "Password must contain a number",
            )
            .refine(
                (password) => /[^A-Za-z0-9]/.test(password),
                "Password must contain a special character",
            ),


    }
);

export type RegisterSchema = z.infer<typeof registerSchema>;