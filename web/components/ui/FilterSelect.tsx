'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface FilterSelectProps {
    name: string;                    // "store" or "sort_by"
    options: Array<{ value: string; label: string }>;
    defaultValue: string;
    className?: string;
}

export default function FilterSelect({
    name,
    options,
    defaultValue,
    className = "",
}: FilterSelectProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString()); // preserve ALL current params

        // Update or set the changed filter
        if (e.target.value) {
            params.set(name, e.target.value);
        } else {
            params.delete(name); // remove if empty (e.g. "all stores")
        }

        router.push(`?${params.toString()}`);
    };

    const value = searchParams.get(name) ?? defaultValue;

    return (
        <select
            name={name}
            value={value}
            onChange={handleChange}
            className={`bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 ${className}`}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}