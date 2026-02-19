"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase } from "@/src/supabaseClient";
import { z } from "zod";

type Bookmark = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  created_at: string;
};

const bookmarkFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  url: z
    .string()
    .trim()
    .min(1, "URL is required")
    .url("Enter a valid URL (include http:// or https://)"),
});

type BookmarkFormErrors = {
  title?: string;
  url?: string;
};

type BookmarkFormField = keyof BookmarkFormErrors;
type TouchedFields = Record<BookmarkFormField, boolean>;

const createInitialTouchedFields = (): TouchedFields => ({
  title: false,
  url: false,
});

const getFieldError = (
  field: BookmarkFormField,
  value: string
): string | undefined => {
  const validation = bookmarkFormSchema.shape[field].safeParse(value);
  if (validation.success) return undefined;
  return validation.error.issues[0]?.message;
};

const getInputOutlineClasses = (
  error: string | undefined,
  touched: boolean,
  value: string
): string => {
  if (error) {
    return "border-rose-500 outline outline-2 outline-rose-400 focus:ring-red-300";
  }
  if (touched && value.trim().length > 0) {
    return "border-emerald-500 outline outline-2 outline-emerald-400 focus:ring-emerald-200";
  }
  return "border-stone-300 focus:ring-blue-300";
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [formErrors, setFormErrors] = useState<BookmarkFormErrors>({});
  const [touchedFields, setTouchedFields] = useState<TouchedFields>(createInitialTouchedFields);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFormErrors, setEditFormErrors] = useState<BookmarkFormErrors>({});
  const [editTouchedFields, setEditTouchedFields] =
    useState<TouchedFields>(createInitialTouchedFields);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bookmark | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isAddFormValid = bookmarkFormSchema.safeParse({ title, url }).success;
  const isEditFormValid = bookmarkFormSchema.safeParse({
    title: editTitle,
    url: editUrl,
  }).success;
  const avatarUrl =
    user && typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;

  // Fetch current user
  useEffect(() => {
    const syncUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) console.error(error);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    syncUser();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch bookmarks & subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const fetchBookmarks = async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) console.error(error);
      setBookmarks(data ?? []);
    };

    fetchBookmarks();

    const channel = supabase
      .channel("bookmarks_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setBookmarks((prev) =>
            prev.some((bookmark) => bookmark.id === payload.new.id)
              ? prev
              : [payload.new as Bookmark, ...prev]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setBookmarks((prev) =>
            prev.map((b) => (b.id === payload.new.id ? (payload.new as Bookmark) : b))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <div className="p-4 text-center">Checking login...</div>;

  return (
    <div className="min-h-screen bg-stone-100 p-4 text-stone-800 sm:p-6">
      {!user ? (
        <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center">
          <div className="w-full rounded-2xl border border-stone-200 bg-stone-50 p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold text-stone-800">Welcome Back</h1>
            <p className="mt-2 text-sm text-stone-600">
              Sign in to manage your bookmarks from one place.
            </p>
            <form
              className="mt-6 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setIsLoggingIn(true);
                try {
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: window.location.origin },
                  });
                } finally {
                  setIsLoggingIn(false);
                }
              }}
            >
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300"
              >
                {isLoggingIn ? "Continuing with Google..." : "Continue with Google"}
              </button>
              <p className="text-xs text-stone-500">Only Google sign-in is supported.</p>
            </form>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-sm sm:p-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h1 className="text-2xl font-semibold text-stone-800">Your Bookmarks</h1>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                {avatarUrl && (
                  <Image
                    src={avatarUrl}
                    alt="User Avatar"
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border border-stone-300 object-cover"
                  />
                )}
                <span
                  className="min-w-0 truncate font-medium text-stone-700"
                  title={user.email ?? ""}
                >
                  {user.email}
                </span>
              </div>
              <button
                disabled={isLoggingOut}
                className="w-full cursor-pointer rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300 sm:w-auto"
                onClick={() => {
                  setIsLogoutModalOpen(true);
                }}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>

          {/* Add Bookmark Form */}
          <form
            className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user) return;

              const validation = bookmarkFormSchema.safeParse({ title, url });
              if (!validation.success) {
                const { fieldErrors } = validation.error.flatten();
                setFormErrors({
                  title: fieldErrors.title?.[0],
                  url: fieldErrors.url?.[0],
                });
                return;
              }

              setFormErrors({});
              const { title: validTitle, url: validUrl } = validation.data;
              setIsAdding(true);
              try {
                const { data: insertedBookmark, error } = await supabase
                  .from("bookmarks")
                  .insert([{ title: validTitle, url: validUrl, user_id: user.id }])
                  .select()
                  .single();
                if (error) return console.error(error);
                if (insertedBookmark) {
                  setBookmarks((prev) =>
                    prev.some((bookmark) => bookmark.id === insertedBookmark.id)
                      ? prev
                      : [insertedBookmark as Bookmark, ...prev]
                  );
                }

                setTitle("");
                setUrl("");
                setTouchedFields(createInitialTouchedFields());
              } finally {
                setIsAdding(false);
              }
            }}
          >
            <div className="w-full sm:flex-1">
              <input
                type="text"
                placeholder="Title"
                value={title}
                aria-invalid={Boolean(formErrors.title)}
                onChange={(e) => {
                  const nextTitle = e.target.value;
                  setTitle(nextTitle);
                  if (touchedFields.title) {
                    setFormErrors((prev) => ({
                      ...prev,
                      title: getFieldError("title", nextTitle),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouchedFields((prev) => ({ ...prev, title: true }));
                  setFormErrors((prev) => ({
                    ...prev,
                    title: getFieldError("title", title),
                  }));
                }}
                className={`w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 ${
                  getInputOutlineClasses(formErrors.title, touchedFields.title, title)
                }`}
              />
              {formErrors.title && (
                <p className="mt-1 text-sm text-rose-600">{formErrors.title}</p>
              )}
            </div>
            <div className="w-full sm:flex-1">
              <input
                type="url"
                placeholder="URL"
                value={url}
                aria-invalid={Boolean(formErrors.url)}
                onChange={(e) => {
                  const nextUrl = e.target.value;
                  setUrl(nextUrl);
                  if (touchedFields.url) {
                    setFormErrors((prev) => ({
                      ...prev,
                      url: getFieldError("url", nextUrl),
                    }));
                  }
                }}
                onBlur={() => {
                  setTouchedFields((prev) => ({ ...prev, url: true }));
                  setFormErrors((prev) => ({
                    ...prev,
                    url: getFieldError("url", url),
                  }));
                }}
                className={`w-full border px-3 py-2 rounded focus:outline-none focus:ring-2 ${
                  getInputOutlineClasses(formErrors.url, touchedFields.url, url)
                }`}
              />
              {formErrors.url && (
                <p className="mt-1 text-sm text-rose-600">{formErrors.url}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={!isAddFormValid || isAdding}
              className="w-full cursor-pointer rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300 sm:w-auto"
            >
              {isAdding ? "Adding..." : "Add"}
            </button>
          </form>

          {/* Bookmarks List */}
          {bookmarks.length === 0 ? (
            <p className="text-stone-600">No bookmarks yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100 shadow-sm">
              <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)_auto] border-b border-stone-200 bg-stone-200/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 md:grid">
                <span>Title</span>
                <span>URL</span>
                <span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-stone-200">
                {bookmarks.map((b) => {
                  const isUpdatingCurrent = updatingId === b.id;
                  const isDeletingCurrent = deletingId === b.id;
                  return (
                    <div key={b.id} className="px-4 py-3">
                      {editingId === b.id ? (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)_auto] md:items-start">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              Title
                            </p>
                            <input
                              type="text"
                              value={editTitle}
                              aria-invalid={Boolean(editFormErrors.title)}
                              onChange={(e) => {
                                const nextEditTitle = e.target.value;
                                setEditTitle(nextEditTitle);
                                if (editTouchedFields.title) {
                                  setEditFormErrors((prev) => ({
                                    ...prev,
                                    title: getFieldError("title", nextEditTitle),
                                  }));
                                }
                              }}
                              onBlur={() => {
                                setEditTouchedFields((prev) => ({ ...prev, title: true }));
                                setEditFormErrors((prev) => ({
                                  ...prev,
                                  title: getFieldError("title", editTitle),
                                }));
                              }}
                              className={`w-full rounded border bg-stone-50 px-2 py-1 text-stone-800 focus:outline-none focus:ring-2 ${
                                getInputOutlineClasses(
                                  editFormErrors.title,
                                  editTouchedFields.title,
                                  editTitle
                                )
                              }`}
                            />
                            {editFormErrors.title && (
                              <p className="mt-1 text-sm text-rose-600">{editFormErrors.title}</p>
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              URL
                            </p>
                            <input
                              type="url"
                              value={editUrl}
                              aria-invalid={Boolean(editFormErrors.url)}
                              onChange={(e) => {
                                const nextEditUrl = e.target.value;
                                setEditUrl(nextEditUrl);
                                if (editTouchedFields.url) {
                                  setEditFormErrors((prev) => ({
                                    ...prev,
                                    url: getFieldError("url", nextEditUrl),
                                  }));
                                }
                              }}
                              onBlur={() => {
                                setEditTouchedFields((prev) => ({ ...prev, url: true }));
                                setEditFormErrors((prev) => ({
                                  ...prev,
                                  url: getFieldError("url", editUrl),
                                }));
                              }}
                              className={`w-full rounded border bg-stone-50 px-2 py-1 text-stone-800 focus:outline-none focus:ring-2 ${
                                getInputOutlineClasses(
                                  editFormErrors.url,
                                  editTouchedFields.url,
                                  editUrl
                                )
                              }`}
                            />
                            {editFormErrors.url && (
                              <p className="mt-1 text-sm text-rose-600">{editFormErrors.url}</p>
                            )}
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              Actions
                            </p>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <button
                                disabled={!isEditFormValid || isUpdatingCurrent}
                                className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-blue-300 disabled:hover:bg-blue-300"
                                onClick={async () => {
                                  if (!user) return;

                                  const validation = bookmarkFormSchema.safeParse({
                                    title: editTitle,
                                    url: editUrl,
                                  });
                                  if (!validation.success) {
                                    const { fieldErrors } = validation.error.flatten();
                                    setEditFormErrors({
                                      title: fieldErrors.title?.[0],
                                      url: fieldErrors.url?.[0],
                                    });
                                    return;
                                  }

                                  setEditFormErrors({});
                                  const { title: validTitle, url: validUrl } = validation.data;
                                  setUpdatingId(b.id);
                                  try {
                                    const { data: updatedBookmark, error } = await supabase
                                      .from("bookmarks")
                                      .update({ title: validTitle, url: validUrl })
                                      .eq("id", b.id)
                                      .eq("user_id", user.id)
                                      .select()
                                      .single();
                                    if (error) return console.error(error);
                                    setBookmarks((prev) =>
                                      prev.map((bm) =>
                                        bm.id === b.id ? (updatedBookmark as Bookmark) : bm
                                      )
                                    );
                                    setEditingId(null);
                                    setEditTouchedFields(createInitialTouchedFields());
                                  } finally {
                                    setUpdatingId(null);
                                  }
                                }}
                              >
                                {isUpdatingCurrent ? "Updating..." : "Update"}
                              </button>
                              <button
                                disabled={isUpdatingCurrent}
                                className="cursor-pointer rounded bg-gray-600 px-3 py-1 text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:bg-gray-300"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditFormErrors({});
                                  setEditTouchedFields(createInitialTouchedFields());
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)_auto] md:items-start">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              Title
                            </p>
                            <p
                              className="whitespace-normal break-words font-medium text-stone-700"
                              title={b.title}
                            >
                              {b.title}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              URL
                            </p>
                            <a
                              href={b.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-full whitespace-normal break-all text-left font-medium text-sky-600 hover:text-sky-700 hover:underline"
                              title={b.url}
                            >
                              {b.url}
                            </a>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 md:hidden">
                              Actions
                            </p>
                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <button
                                className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                onClick={() => {
                                  setEditingId(b.id);
                                  setEditTitle(b.title);
                                  setEditUrl(b.url);
                                  setEditFormErrors({});
                                  setEditTouchedFields(createInitialTouchedFields());
                                }}
                              >
                                Edit
                              </button>
                              <button
                                disabled={Boolean(deletingId)}
                                className="cursor-pointer rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300"
                                onClick={() => {
                                  setDeleteTarget(b);
                                }}
                              >
                                {isDeletingCurrent ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-bookmark-title"
            className="w-full max-w-md rounded-lg border border-stone-200 bg-stone-50 p-5 shadow-lg"
          >
            <h2 id="delete-bookmark-title" className="text-lg font-semibold text-stone-800">
              Delete bookmark?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              This action cannot be undone. Do you want to delete this bookmark?
            </p>
            <div className="mt-3 rounded-md border border-stone-200 bg-stone-100 p-3 text-sm">
              <p
                className="whitespace-normal break-words font-medium text-stone-700"
                title={deleteTarget.title}
              >
                {deleteTarget.title}
              </p>
              <p className="whitespace-normal break-all text-stone-600" title={deleteTarget.url}>
                {deleteTarget.url}
              </p>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                disabled={Boolean(deletingId)}
                className="cursor-pointer rounded bg-gray-600 px-3 py-1 text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:bg-gray-300"
                onClick={() => {
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                disabled={Boolean(deletingId)}
                className="cursor-pointer rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300"
                onClick={async () => {
                  if (!user || !deleteTarget) return;
                  setDeletingId(deleteTarget.id);
                  try {
                    const { error } = await supabase
                      .from("bookmarks")
                      .delete()
                      .eq("id", deleteTarget.id)
                      .eq("user_id", user.id);
                    if (error) {
                      console.error(error);
                      return;
                    }
                    setBookmarks((prev) => prev.filter((bm) => bm.id !== deleteTarget.id));
                    setDeleteTarget(null);
                  } finally {
                    setDeletingId(null);
                  }
                }}
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            className="w-full max-w-md rounded-lg border border-stone-200 bg-stone-50 p-5 shadow-lg"
          >
            <h2 id="logout-modal-title" className="text-lg font-semibold text-stone-800">
              Log out?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              You will need to sign in again with Google to continue.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                disabled={isLoggingOut}
                className="cursor-pointer rounded bg-gray-600 px-3 py-1 text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:bg-gray-300"
                onClick={() => {
                  setIsLogoutModalOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                disabled={isLoggingOut}
                className="cursor-pointer rounded bg-red-600 px-3 py-1 text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300"
                onClick={async () => {
                  setIsLoggingOut(true);
                  try {
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                      console.error(error);
                      return;
                    }
                    setIsLogoutModalOpen(false);
                    setUser(null);
                    setBookmarks([]);
                  } finally {
                    setIsLoggingOut(false);
                  }
                }}
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
