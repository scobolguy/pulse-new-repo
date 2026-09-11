import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class MapperClient {
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    private MapperClient() {}

    public static String callSync(String baseUrl, String requestJson) throws Exception {
        return call(baseUrl + "/map", requestJson);
    }

    public static String callAsync(String baseUrl, String requestJson) throws Exception {
        return call(baseUrl + "/map/async", requestJson);
    }

    private static String call(String url, String requestJson) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();
        HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200 && response.statusCode() != 202) {
            throw new IllegalStateException("mapper call failed: HTTP " + response.statusCode());
        }
        return response.body();
    }
}
