/**
 * CLOUDFLARE PAGES FUNCTION - FCM PROXY
 * 
 * Bu dosia Cloudflare Pages üzerinde çalışarak tarayıcı CORS engelini aşar.
 * Konum: /functions/fcm_proxy.js
 */

export async function onRequest(context) {
    const { request } = context;

    // Sadece POST ve OPTIONS (CORS) isteklerini kabul et
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // Gelen veriyi oku
        const body = await request.json();
        const authHeader = request.headers.get("Authorization");

        // Google FCM API'sine ilet
        const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(body)
        });

        // Yanıtı al
        const responseData = await fcmResponse.json();

        // Yanıtı tarayıcıya geri döndür
        return new Response(JSON.stringify(responseData), {
            status: fcmResponse.status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
